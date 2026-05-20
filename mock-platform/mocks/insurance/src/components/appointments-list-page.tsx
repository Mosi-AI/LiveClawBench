/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { formatCents, capitalize } from "./format";

export interface AppointmentRow {
  id: number;
  provider_name: string;
  service_name_snapshot: string;
  check_item: string;
  slot_start_time: string;
  slot_end_time: string;
  cost_snapshot: number;
  distance_km_snapshot: number;
  status: string;
  network_status: string;
}

interface AppointmentsListPageProps {
  user: { first_name: string; last_name: string };
  appointments: AppointmentRow[];
}

export const AppointmentsListPage: FC<AppointmentsListPageProps> = ({
  user,
  appointments,
}) => {
  return (
    <Layout title="My Appointments" user={user}>
      <h1>My Appointments</h1>
      {appointments.length === 0 ? (
        <p class="empty-state">
          You have no appointments yet.{" "}
          <a href="/appointments/search">Find a provider</a> to book one.
        </p>
      ) : (
        <table class="data-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Service</th>
              <th>Network</th>
              <th>Start</th>
              <th>End</th>
              <th>Cost</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} data-appointment-id={a.id}>
                <td>{a.provider_name}</td>
                <td>{a.service_name_snapshot}</td>
                <td>{a.network_status}</td>
                <td>{a.slot_start_time}</td>
                <td>{a.slot_end_time}</td>
                <td>{formatCents(a.cost_snapshot)}</td>
                <td class={`status-${a.status}`}>{capitalize(a.status)}</td>
                <td>
                  {a.status === "cancelled" ? (
                    <span class="muted">—</span>
                  ) : (
                    <form
                      method="post"
                      action={`/appointments/${a.id}/cancel`}
                      class="inline-form"
                    >
                      <button type="submit" class="cancel-button">
                        Cancel
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
};
