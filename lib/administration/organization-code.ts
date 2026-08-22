export const ORGANIZATION_CODE_PATTERN_SOURCE =
  String.raw`[\p{L}\p{N}][\p{L}\p{M}\p{N}._\-]*`;

export const ORGANIZATION_CODE_PATTERN = new RegExp(
  `^(?:${ORGANIZATION_CODE_PATTERN_SOURCE})$`,
  "u",
);
