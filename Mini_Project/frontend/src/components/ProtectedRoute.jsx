import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, checkingSession } = useAuth();

  if (checkingSession) {
    return <div className="screen-loader">Restoring your session...</div>;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
