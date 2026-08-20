import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ROUTES } from "./routes";

// [DATA: MOCK ⚠️] Auth gate is a no-op: hardcoded `true`, so /login is
// never actually enforced. The Zustand auth store exists but is unused,
// and LoginForm only simulates a login (see components/forms/LoginForm).
const isAuthenticated = true;

const ProtectedRoute = () => {
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;