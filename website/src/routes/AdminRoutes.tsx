import { Navigate, Route, Routes, useParams } from "react-router";
import { AdminRoleProvider, adminPaths, useAdminPaths, type AdminRole } from "@/components/admin/AdminParts";
import { SuperAdminLayout, VenueAdminLayout } from "@/components/admin/AdminMenus";
import AdminDashboardPage, { AdminVenueListPage } from "@/pages/admin/AdminDashboardPage";
import { AdminSlotsPage, CourtPhotosPage, EditCourtPage, EditVenueDetailsPage, ManageCourtsPage, VenuePhotosPage } from "@/pages/admin/VenueEditPages";
import { AdminAnalyticsPage, AdminNotificationsPage, AdminReviewsPage, AssignAdminPage, BoostVenuePage, VenueBookingsPage } from "@/pages/admin/VenueBusinessPages";
import { AllEventsListPage, AllGamesListPage, AllGroupsListPage, AllUsersListPage, AllVenuesListPage, CreateVenuePage, ModerationPage } from "@/pages/admin/SuperAdminPages";
import { AuthCallbackRedirect } from "./returnTo";

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
