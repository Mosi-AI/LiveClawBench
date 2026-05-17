/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { formatCents } from "./format";

interface Service {
  id: number;
  check_item: string;
  service_name: string;
  cost: number;
}

interface Slot {
  id: number;
  start_time: string;
  end_time: string;
}

interface Provider {
  id: number;
  name: string;
  district: string;
  distance_km: number;
  network_status: string;
}

interface ProviderDetailPageProps {
  user: { first_name: string; last_name: string };
  provider: Provider;
  services: Service[];
  slotsByService: Record<number, Slot[]>;
}

function formatSlot(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString()} ${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export const ProviderDetailPage: FC<ProviderDetailPageProps> = ({
  user,
  provider,
  services,
  slotsByService,
}) => {
  return (
    <Layout title={provider.name} user={user}>
      <h1>{provider.name}</h1>
      <a href="/appointments/search">← Back to Search</a>
      <div class="detail-card">
        <p>
          <strong>District:</strong> {provider.district}
        </p>
        <p>
          <strong>Distance:</strong> {provider.distance_km} km
        </p>
        <p>
          <strong>Network:</strong> {provider.network_status}
        </p>
      </div>

      <h2>Services & Available Slots</h2>
      {services.map((svc) => (
        <div key={svc.id} class="service-card">
          <h3>
            {svc.service_name} ({formatCents(svc.cost)})
          </h3>
          {slotsByService[svc.id]?.length ? (
            <form
              method="post"
              action="/appointments/book"
              class="slot-form"
            >
              <input type="hidden" name="provider_id" value={String(provider.id)} />
              <label>
                Select a slot:
                <select name="slot_id" required>
                  {slotsByService[svc.id].map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {formatSlot(slot.start_time, slot.end_time)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Book Appointment</button>
            </form>
          ) : (
            <p>No available slots.</p>
          )}
        </div>
      ))}
    </Layout>
  );
};
