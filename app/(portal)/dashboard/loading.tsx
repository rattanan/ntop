export default function DashboardLoading() {
  return <div className="dashboard-loading" data-testid="dashboard-loading" aria-busy="true" aria-label="กำลังโหลด Dashboard">
    <div className="dashboard-skeleton dashboard-skeleton-head"/>
    <div className="dashboard-skeleton dashboard-skeleton-filter"/>
    <div className="dashboard-kpi-grid">{Array.from({ length: 8 }, (_, index) => <div className="dashboard-skeleton dashboard-skeleton-kpi" key={index}/>)}</div>
    <div className="dashboard-chart-grid">{Array.from({ length: 4 }, (_, index) => <div className="dashboard-skeleton dashboard-skeleton-chart" key={index}/>)}</div>
  </div>;
}
