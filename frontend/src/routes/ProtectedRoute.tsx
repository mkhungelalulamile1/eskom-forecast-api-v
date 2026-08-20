import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ROUTES } from "./routes";

// TODO:
// Replace this with your authentication state from
// Zustand, Redux, Context, React Query, etc.
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