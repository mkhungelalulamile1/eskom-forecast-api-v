// DashboardPage is NOT routed (no entry in routes/navigation) — dead screen.
// [DATA: DYNAMIC] panels fetch live /api data; see components/dashboard/*.
import DashboardContent from "../../components/dashboard/DashboardContent";


const DashboardPage = () => {
  return <DashboardContent />;
};

export default DashboardPage;