import type { AuthorizationContext } from "../authorization/authorization-context";
import { assertPermission, PERMISSIONS, PermissionDeniedError, type Permission, type PermissionPolicy, permissionPolicy } from "../authorization/permission-policy";
import type { AuditWriter } from "../audit/audit-writer";
import { calculateContractFinancials } from "./contract-financials";
import type { ContractCreateInput, ContractEditInput } from "./contracts";

export type ContractActor = { id: string; role: "ADMIN" | "SALES" | "VIEWER"; authorization: AuthorizationContext };
export type ContractRecord = { id: string; contractNo: string; customerId: string; ownerId: string; version: number; statusCode: string; terminal: boolean; latestVersionId: string; cleanSignatureParties: string[] };
type QuoteSource = { quoteId: string; quoteVersionId: string; status: string; customerId: string; opportunityId: string | null; organizationUnitId: string | null; proposalId: string | null; currency: string; sourceSnapshot: Record<string, unknown> };
type Transition = { requiredPermission: string | null; makerChecker: boolean; requiredSignatureParties: string[] };

export interface ContractRepository<Tx> {
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
  findAcceptedQuoteVersion(id: string, context: AuthorizationContext, tx: Tx): Promise<QuoteSource | null>;
  typeIsActive(code: string, tx: Tx): Promise<boolean>;
  findInitialStatus(tx: Tx): Promise<string | null>;
  nextNumber(now: Date, tx: Tx): Promise<string>;
  create(input: { actorId: string; contractNo: string; source: QuoteSource; draft: ContractCreateInput; financials: ReturnType<typeof calculateContractFinancials>; statusCode: string }, tx: Tx): Promise<ContractRecord>;
  find(id: string, context: AuthorizationContext, tx: Tx): Promise<ContractRecord | null>;
  loadCurrentDraft(contractId: string, context: AuthorizationContext, tx: Tx): Promise<ContractEditInput | null>;
  createVersion(input: { contract: ContractRecord; expectedVersion: number; actorId: string; draft: ContractEditInput; financials: ReturnType<typeof calculateContractFinancials>; statusCode: string; sourceSnapshot?: Record<string, unknown>; amendmentId?: string }, tx: Tx): Promise<ContractRecord | null>;
  createAmendment(input:{contract:ContractRecord;actorId:string;amendmentTypeCode:string;reason:string},tx:Tx):Promise<{id:string;amendmentNo:string}>;
  completeAmendment(id:string,resultingVersionNumber:number,tx:Tx):Promise<void>;
  findTransition(from: string, to: string, tx: Tx): Promise<Transition | null>;
  statusIsActive(code: string, tx: Tx): Promise<{ terminal: boolean } | null>;
  actorHasPermission(actorId: string, permission: string, tx: Tx): Promise<boolean>;
  createSignature(input: { contract: ContractRecord; actorId: string; partyCode: string; documentVersionId: string; signedByName: string; signedAt: Date }, tx: Tx): Promise<boolean>;
  createServiceOrder(input: { contract: ContractRecord; actorId: string; now: Date }, tx: Tx): Promise<{ id: string; orderNo: string }>;
}

export class ContractService<Tx> {
  constructor(private readonly repository: ContractRepository<Tx>, private readonly audit: AuditWriter<Tx>, private readonly permissions: PermissionPolicy = permissionPolicy, private readonly now = () => new Date()) {}

  async create(actor: ContractActor, draft: ContractCreateInput, correlationId: string) {
    assertPermission(actor, PERMISSIONS.contractManage, this.permissions);
    return this.repository.transaction(async (tx) => {
      const [source, typeActive, statusCode] = await Promise.all([this.repository.findAcceptedQuoteVersion(draft.quoteVersionId, actor.authorization, tx), this.repository.typeIsActive(draft.contractTypeCode, tx), this.repository.findInitialStatus(tx)]);
      if (!source || source.status !== "ACCEPTED") throw new ContractAccessError();
      if (!typeActive || !statusCode) throw new ContractConfigurationError();
      assertDateRange(draft.startDate, draft.endDate);
      const financials = calculateContractFinancials(draft.items, draft.taxRate);
      const created = await this.repository.create({ actorId: actor.id, contractNo: await this.repository.nextNumber(this.now(), tx), source, draft, financials, statusCode }, tx);
      await this.audit.append({ actorId: actor.id, action: "contract.create", targetType: "Contract", targetId: created.id, targetVersion: "1", outcome: "SUCCESS", correlationId, data: { quoteVersionId: source.quoteVersionId, customerId: source.customerId } }, { transaction: tx });
      return created;
    });
  }

  async edit(actor: ContractActor, contractId: string, draft: ContractEditInput, correlationId: string) {
    assertPermission(actor, PERMISSIONS.contractManage, this.permissions);
    return this.repository.transaction(async (tx) => {
      const contract = await this.required(contractId, actor, tx);
      this.mutable(contract, draft.expectedVersion);
      assertDateRange(draft.startDate, draft.endDate);
      const updated = await this.repository.createVersion({ contract, expectedVersion: draft.expectedVersion, actorId: actor.id, draft, financials: calculateContractFinancials(draft.items, draft.taxRate), statusCode: contract.statusCode }, tx);
      if (!updated) throw new ContractVersionConflictError();
      await this.audit.append({ actorId: actor.id, action: "contract.version.create", targetType: "Contract", targetId: contract.id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { changeReason: draft.changeReason } }, { transaction: tx });
      return updated;
    });
  }

  async transition(actor: ContractActor, contractId: string, expectedVersion: number, toStatusCode: string, comment: string, correlationId: string) {
    return this.repository.transaction(async (tx) => {
      const contract = await this.required(contractId, actor, tx);
      this.mutable(contract, expectedVersion);
      const [edge, target] = await Promise.all([this.repository.findTransition(contract.statusCode, toStatusCode, tx), this.repository.statusIsActive(toStatusCode, tx)]);
      if (!edge || !target) throw new ContractTransitionError();
      if (edge.makerChecker && contract.ownerId === actor.id) throw new ContractMakerCheckerError();
      const requiredPermission = edge.requiredPermission ?? PERMISSIONS.contractManage;
      if (!(await this.hasPermission(actor, requiredPermission, tx))) throw new PermissionDeniedError(requiredPermission as Permission);
      if (edge.requiredSignatureParties.some((party) => !contract.cleanSignatureParties.includes(party))) throw new ContractSignatureRequiredError();
      const draft = await this.snapshotDraft(contractId, actor, tx, expectedVersion, comment);
      const updated = await this.repository.createVersion({ contract, expectedVersion, actorId: actor.id, draft, financials: calculateContractFinancials(draft.items, draft.taxRate), statusCode: toStatusCode }, tx);
      if (!updated) throw new ContractVersionConflictError();
      await this.audit.append({ actorId: actor.id, action: "contract.transition", targetType: "Contract", targetId: contract.id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { fromStatusCode: contract.statusCode, toStatusCode, comment } }, { transaction: tx });
      return updated;
    });
  }

  async createServiceOrder(actor: ContractActor, contractId: string, correlationId: string) {
    assertPermission(actor, PERMISSIONS.contractServiceOrderCreate, this.permissions);
    return this.repository.transaction(async (tx) => {
      const contract = await this.required(contractId, actor, tx);
      if (!new Set(["EFFECTIVE", "READY_FOR_SERVICE_ORDER"]).has(contract.statusCode)) throw new ContractServiceOrderError();
      const order = await this.repository.createServiceOrder({ contract, actorId: actor.id, now: this.now() }, tx);
      await this.audit.append({ actorId: actor.id, action: "contract.service-order.create", targetType: "ContractServiceOrder", targetId: order.id, targetVersion: "1", outcome: "SUCCESS", correlationId, data: { contractId } }, { transaction: tx });
      return order;
    });
  }

  async recordManualSignature(actor: ContractActor, contractId: string, input: { expectedVersion: number; partyCode: string; documentVersionId: string; signedByName: string; signedAt: string }, correlationId: string) {
    assertPermission(actor, PERMISSIONS.contractSignatureManage, this.permissions);
    return this.repository.transaction(async (tx) => {
      const contract = await this.required(contractId, actor, tx);
      this.mutable(contract, input.expectedVersion);
      const recorded = await this.repository.createSignature({ contract, actorId: actor.id, partyCode: input.partyCode, documentVersionId: input.documentVersionId, signedByName: input.signedByName, signedAt: new Date(input.signedAt) }, tx);
      if (!recorded) throw new ContractSignatureRequiredError();
      await this.audit.append({ actorId: actor.id, action: "contract.signature.manual-record", targetType: "Contract", targetId: contract.id, targetVersion: String(contract.version), outcome: "SUCCESS", correlationId, data: { partyCode: input.partyCode, documentVersionId: input.documentVersionId } }, { transaction: tx });
      return contract;
    });
  }

  async amend(actor:ContractActor,contractId:string,input:{expectedVersion:number;amendmentTypeCode:string;reason:string;draft:Omit<ContractEditInput,"expectedVersion"|"changeReason">},correlationId:string){assertPermission(actor,PERMISSIONS.contractManage,this.permissions);return this.repository.transaction(async tx=>{const contract=await this.required(contractId,actor,tx);this.mutable(contract,input.expectedVersion);const draft:ContractEditInput={...input.draft,expectedVersion:input.expectedVersion,changeReason:input.reason},amendment=await this.repository.createAmendment({contract,actorId:actor.id,amendmentTypeCode:input.amendmentTypeCode,reason:input.reason},tx),updated=await this.repository.createVersion({contract,expectedVersion:input.expectedVersion,actorId:actor.id,draft,financials:calculateContractFinancials(draft.items,draft.taxRate),statusCode:"INTERNAL_REVIEW",amendmentId:amendment.id},tx);if(!updated)throw new ContractVersionConflictError();await this.repository.completeAmendment(amendment.id,updated.version,tx);await this.audit.append({actorId:actor.id,action:"contract.amendment.create",targetType:"ContractAmendment",targetId:amendment.id,targetVersion:"1",outcome:"SUCCESS",correlationId,data:{contractId,sourceVersionNumber:contract.version,resultingVersionNumber:updated.version,amendmentTypeCode:input.amendmentTypeCode}},{transaction:tx});return{contract:updated,amendment};});}

  private async required(id: string, actor: ContractActor, tx: Tx) { const record = await this.repository.find(id, actor.authorization, tx); if (!record) throw new ContractAccessError(); return record; }
  private mutable(contract: ContractRecord, expected: number) { if (contract.version !== expected) throw new ContractVersionConflictError(); if (contract.terminal) throw new ContractTerminalError(); }
  private async hasPermission(actor: ContractActor, code: string, tx: Tx) { const known = Object.values(PERMISSIONS).includes(code as Permission); if (!known) throw new ContractConfigurationError(); return this.permissions.allows(actor, code as Permission) || this.repository.actorHasPermission(actor.id, code, tx); }
  private async snapshotDraft(id: string, actor: ContractActor, tx: Tx, expected: number, reason: string): Promise<ContractEditInput> { const draft = await this.repository.loadCurrentDraft(id, actor.authorization, tx); if (!draft) throw new ContractAccessError(); return { ...draft, expectedVersion: expected, changeReason: reason }; }
}

function assertDateRange(start?: string | null, end?: string | null) { if (start && end && new Date(end) <= new Date(start)) throw new ContractDateRangeError(); }
export class ContractAccessError extends Error { constructor() { super("Contract is not available."); this.name = "ContractAccessError"; } }
export class ContractConfigurationError extends Error { constructor(message = "Contract configuration is unavailable.") { super(message); this.name = "ContractConfigurationError"; } }
export class ContractVersionConflictError extends Error { constructor() { super("Contract version is stale."); this.name = "ContractVersionConflictError"; } }
export class ContractTransitionError extends Error { constructor() { super("Contract status transition is not allowed."); this.name = "ContractTransitionError"; } }
export class ContractMakerCheckerError extends Error { constructor() { super("Maker-checker separation is required."); this.name = "ContractMakerCheckerError"; } }
export class ContractSignatureRequiredError extends Error { constructor() { super("Required clean signatures are missing."); this.name = "ContractSignatureRequiredError"; } }
export class ContractServiceOrderError extends Error { constructor() { super("Contract is not eligible for service-order handover."); this.name = "ContractServiceOrderError"; } }
export class ContractTerminalError extends Error { constructor() { super("Terminal contract cannot be changed."); this.name = "ContractTerminalError"; } }
export class ContractDateRangeError extends Error { constructor() { super("Contract end date must be after start date."); this.name = "ContractDateRangeError"; } }
