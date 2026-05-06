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

interface Filters {
  check_item: string;
  district: string;
  network_status: string;
  max_distance: string;
  max_price: string;
}

interface AppointmentsSearchPageProps {
  user: { first_name: string; last_name: string };
  providers: Provider[];
  filters: Filters;
}

export const AppointmentsSearchPage: FC<AppointmentsSearchPageProps> = ({
  user,
  providers,
  filters,
}) => {
  return (
    <Layout title="Find Providers" user={user}>
      <h1>Find Providers</h1>
      <form method="get" action="/appointments/search" class="filter-form">
        <label>
          Check Item:
          <select name="check_item">
            <option value="" selected={filters.check_item === ""}>
              All
            </option>
            <option
              value="general_checkup"
              selected={filters.check_item === "general_checkup"}
            >
              General Checkup
            </option>
            <option value="dental" selected={filters.check_item === "dental"}>
              Dental
            </option>
            <option value="vision" selected={filters.check_item === "vision"}>
              Vision
            </option>
            <option value="lab" selected={filters.check_item === "lab"}>
              Lab
            </option>
            <option value="imaging" selected={filters.check_item === "imaging"}>
              Imaging
            </option>
            <option
              value="specialist"
              selected={filters.check_item === "specialist"}
            >
              Specialist
            </option>
          </select>
        </label>
        <label>
          District:
          <input
            type="text"
            name="district"
            value={filters.district}
            placeholder="e.g. Central"
          />
        </label>
        <label>
          Network:
          <select name="network_status">
            <option value="" selected={filters.network_status === ""}>
              All
            </option>
            <option
              value="in_network"
              selected={filters.network_status === "in_network"}
            >
              In Network
            </option>
            <option
              value="out_of_network"
              selected={filters.network_status === "out_of_network"}
            >
              Out of Network
            </option>
          </select>
        </label>
        <label>
          Max Distance (km):
          <input
            type="number"
            name="max_distance"
            value={filters.max_distance}
            placeholder="e.g. 5"
          />
        </label>
        <label>
          Max Price (cents):
          <input
            type="number"
            name="max_price"
            value={filters.max_price}
            placeholder="e.g. 3000"
          />
        </label>
        <button type="submit">Filter</button>
        <a href="/appointments/search" class="button-link">
          Clear
        </a>
      </form>
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
