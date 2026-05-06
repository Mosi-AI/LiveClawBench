/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout";

interface Provider {
  id: number;
  name: string;
  district: string;
  distance_km: number;
  network_status: string;
}

interface AppointmentsSearchPageProps {
  user: { first_name: string; last_name: string };
  providers: Provider[];
}

export const AppointmentsSearchPage: FC<AppointmentsSearchPageProps> = ({
  user,
  providers,
}) => {
  return (
    <Layout title="Find Providers" user={user}>
      <h1>Find Providers</h1>
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>District</th>
            <th>Distance</th>
            <th>Network</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.district}</td>
              <td>{p.distance_km} km</td>
              <td>{p.network_status}</td>
              <td>
                <a href={`/appointments/providers/${p.id}`}>View</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
};
