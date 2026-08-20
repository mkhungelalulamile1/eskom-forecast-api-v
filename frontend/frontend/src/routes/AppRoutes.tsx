import { lazy, Suspense } from "react";

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import {
  CircularProgress,
  Box,
} from "@mui/material";


import AuthLayout from "../layouts/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout";

import ProtectedRoute from "./ProtectedRoute";
import { ROUTES } from "./routes";


// Auth
import LoginPage from "../pages/auth/LoginPage";



// Lazy Loaded Features

const ForecastPage = lazy(
  () =>
    import(
      "../features/forecast/pages/ForecastPage"
    )
);



const ModelPerformancePage = lazy(
  () =>
    import(
      "../features/model-performance/pages/ModelPerformancePage"
    )
);



const InferencePage = lazy(
  () =>
    import(
      "../features/inference/pages/InferencePage"
    )
);

const InferenceMonitoringPage = lazy(
  () =>
    import(
      "../features/inference-monitoring/pages/InferenceMonitoringPage"
    )
);



const PageLoader = () => (

  <Box

    sx={{

      display:"flex",

      justifyContent:"center",

      alignItems:"center",

      minHeight:"60vh",

    }}

  >

    <CircularProgress />

  </Box>

);





const AppRoutes = () => {


return (

<Routes>


  {/* Root */}

  <Route

    path="/"

    element={
      <Navigate
        to={ROUTES.FORECAST}
        replace
      />
    }

  />





  {/* Authentication */}

  <Route

    element={
      <AuthLayout />
    }

  >

    <Route

      path={ROUTES.LOGIN}

      element={
        <LoginPage />
      }

    />

  </Route>







  {/* Protected Application */}

  <Route

    element={
      <ProtectedRoute />
    }

  >

    <Route

      element={
        <DashboardLayout />
      }

    >



      <Route

        path={ROUTES.FORECAST}

        element={

          <Suspense fallback={<PageLoader />}>

            <ForecastPage />

          </Suspense>

        }

      />





      <Route

        path={ROUTES.MODEL_PERFORMANCE}

        element={

          <Suspense fallback={<PageLoader />}>

            <ModelPerformancePage />

          </Suspense>

        }

      />





      <Route

        path={ROUTES.INFERENCE}

        element={

          <Suspense fallback={<PageLoader />}>

            <InferencePage />

          </Suspense>

        }

      />

      <Route
        path={ROUTES.INFERENCE_MONITORING}
        element={
          <Suspense fallback={<PageLoader />}>
            <InferenceMonitoringPage />
          </Suspense>
        }
      />



    </Route>


  </Route>






  {/* Catch All */}

  <Route

    path="*"

    element={

      <Navigate

        to={ROUTES.FORECAST}

        replace

      />

    }

  />


</Routes>

);

};


export default AppRoutes;