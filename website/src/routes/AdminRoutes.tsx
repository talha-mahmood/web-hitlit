import { lazy } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { AdminRoleProvider, adminPaths, useAdminPaths, type AdminRole } from "@/components/admin/AdminParts";
import { SuperAdminLayout, VenueAdminLayout } from "@/components/admin/AdminMenus";
import { AuthCallbackRedirect } from "./returnTo";

// Each page loads on first visit (its own chunk).
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage"));
const AdminVenueListPage = lazy(() => import("@/pages/admin/AdminDashboardPage").then((m) => ({ default: m.AdminVenueListPage })));
const AdminSlotsPage = lazy(() => import("@/pages/admin/VenueEditPages").then((m) => ({ default: m.AdminSlotsPage })));
const CourtPhotosPage = lazy(() => import("@/pages/admin/VenueEditPages").then((m) => ({ default: m.CourtPhotosPage })));
const EditCourtPage = lazy(() => import("@/pages/admin/VenueEditPages").then((m) => ({ default: m.EditCourtPage })));
const EditVenueDetailsPage = lazy(() => import("@/pages/admin/VenueEditPages").then((m) => ({ default: m.EditVenueDetailsPage })));
const ManageCourtsPage = lazy(() => import("@/pages/admin/VenueEditPages").then((m) => ({ default: m.ManageCourtsPage })));
const VenuePhotosPage = lazy(() => import("@/pages/admin/VenueEditPages").then((m) => ({ default: m.VenuePhotosPage })));
const AdminAnalyticsPage = lazy(() => import("@/pages/admin/VenueBusinessPages").then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminNotificationsPage = lazy(() => import("@/pages/admin/VenueBusinessPages").then((m) => ({ default: m.AdminNotificationsPage })));
const AdminReviewsPage = lazy(() => import("@/pages/admin/VenueBusinessPages").then((m) => ({ default: m.AdminReviewsPage })));
const AssignAdminPage = lazy(() => import("@/pages/admin/VenueBusinessPages").then((m) => ({ default: m.AssignAdminPage })));
const BoostVenuePage = lazy(() => import("@/pages/admin/VenueBusinessPages").then((m) => ({ default: m.BoostVenuePage })));
const VenueBookingsPage = lazy(() => import("@/pages/admin/VenueBusinessPages").then((m) => ({ default: m.VenueBookingsPage })));
const AllEventsListPage = lazy(() => import("@/pages/admin/SuperAdminPages").then((m) => ({ default: m.AllEventsListPage })));
const AllGamesListPage = lazy(() => import("@/pages/admin/SuperAdminPages").then((m) => ({ default: m.AllGamesListPage })));
const AllGroupsListPage = lazy(() => import("@/pages/admin/SuperAdminPages").then((m) => ({ default: m.AllGroupsListPage })));
const AllUsersListPage = lazy(() => import("@/pages/admin/SuperAdminPages").then((m) => ({ default: m.AllUsersListPage })));
const AllVenuesListPage = lazy(() => import("@/pages/admin/SuperAdminPages").then((m) => ({ default: m.AllVenuesListPage })));
const CreateVenuePage = lazy(() => import("@/pages/admin/SuperAdminPages").then((m) => ({ default: m.CreateVenuePage })));
const ModerationPage = lazy(() => import("@/pages/admin/SuperAdminPages").then((m) => ({ default: m.ModerationPage })));

// Unknown sub-pages of a venue fall back to its dashboard.
function ToVenueDashboard() {
  const { venueId = "" } = useParams();
  return <Navigate to={useAdminPaths().venue(venueId)} replace />;
}

// The venue's own pages (AdminNavigator's stack, shared by SuperAdminNavigator
// for any venue a superadmin opens), rendered inside the venue menu layout.
function venueRoutes(role: AdminRole) {
  return (
    <Route path="venues/:venueId" element={<VenueAdminLayout />}>
      <Route index element={<AdminDashboardPage />} />
      <Route path="edit" element={<EditVenueDetailsPage />} />
      <Route path="photos" element={<VenuePhotosPage />} />
      <Route path="courts" element={<ManageCourtsPage />} />
      <Route path="courts/new" element={<EditCourtPage />} />
      <Route path="courts/:courtId" element={<EditCourtPage />} />
      <Route path="courts/:courtId/photos" element={<CourtPhotosPage />} />
      <Route path="courts/:courtId/slots" element={<AdminSlotsPage />} />
      <Route path="bookings" element={<VenueBookingsPage />} />
      <Route path="reviews" element={<AdminReviewsPage />} />
      <Route path="analytics" element={<AdminAnalyticsPage />} />
      <Route path="boost" element={<BoostVenuePage />} />
      {role === "owner" && <Route path="admins" element={<AssignAdminPage />} />}
      <Route path="*" element={<ToVenueDashboard />} />
    </Route>
  );
}

// Venue admins ("owner") and superadmins get their own area, like the app's
// AdminNavigator / SuperAdminNavigator.
export default function AdminRoutes({ role }: { role: AdminRole }) {
  const p = adminPaths(role);
  return (
    <AdminRoleProvider value={role}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackRedirect />} />
        {role === "owner" ? (
          <Route path="/admin">
            <Route index element={<AdminVenueListPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            {venueRoutes("owner")}
          </Route>
        ) : (
          <Route path="/superadmin">
            <Route element={<SuperAdminLayout />}>
              <Route index element={<AllVenuesListPage />} />
              <Route path="venues/new" element={<CreateVenuePage />} />
              <Route path="venues/:venueId/admins" element={<AssignAdminPage />} />
              <Route path="games" element={<AllGamesListPage />} />
              <Route path="groups" element={<AllGroupsListPage />} />
              <Route path="events" element={<AllEventsListPage />} />
              <Route path="reports" element={<ModerationPage />} />
              <Route path="users" element={<AllUsersListPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
            </Route>
            {venueRoutes("superadmin")}
          </Route>
        )}
        <Route path="*" element={<Navigate to={p.home} replace />} />
      </Routes>
    </AdminRoleProvider>
  );
}
