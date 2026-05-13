import { z } from "zod";

// ── Common response wrappers ──────────────────────────────────────────

export function OkSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    message: z.string().optional(),
    data: dataSchema,
  });
}

export const ErrSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

// ── Pagination ────────────────────────────────────────────────────────

export const PageQuerySchema = z.object({
  page: z.string().optional(),
  per_page: z.string().optional(),
});

export const PaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T, key: string) =>
  z.object({
    [key]: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    per_page: z.number(),
    pages: z.number(),
  });

// ── Auth / User ───────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  is_verified: z.number(),
  is_active: z.number(),
});

export const AuthRegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
});

export const AuthLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const AuthChangePasswordBodySchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(1),
});

export const AuthProfileUpdateBodySchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional(),
  date_of_birth: z.string().optional().nullable(),
});

export const AuthTokenResponseSchema = z.object({
  user: UserSchema,
  access_token: z.string(),
  refresh_token: z.string(),
});

// ── Flights ───────────────────────────────────────────────────────────

export const FlightSchema = z.object({
  id: z.number(),
  flight_number: z.string(),
  airline: z.string(),
  origin_code: z.string(),
  origin_city: z.string(),
  origin_airport: z.string(),
  destination_code: z.string(),
  destination_city: z.string(),
  destination_airport: z.string(),
  departure_time: z.string(),
  arrival_time: z.string(),
  duration_minutes: z.number(),
  base_price_economy: z.number(),
  base_price_business: z.number(),
  base_price_first: z.number(),
  aircraft_type: z.string(),
  status: z.string(),
  gate: z.string().nullable(),
  terminal: z.string().nullable(),
  delay_minutes: z.number().nullable(),
});

export const SeatSchema = z.object({
  id: z.number(),
  flight_id: z.number(),
  seat_number: z.string(),
  cabin_class: z.string(),
  price: z.number(),
  is_available: z.number(),
  is_window: z.number(),
  is_aisle: z.number(),
  has_extra_legroom: z.number(),
  row_number: z.number(),
  seat_letter: z.string(),
});

export const FlightListQuerySchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  date: z.string().optional(),
  min_price: z.string().optional(),
  max_price: z.string().optional(),
  status: z.string().optional(),
  page: z.string().optional(),
  per_page: z.string().optional(),
});

export const FlightSearchBodySchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  departure_date: z.string().min(1),
  passengers: z.number().optional(),
  cabin_class: z.string().optional(),
});

export const FlightIdParamSchema = z.object({
  flight_id: z.string().regex(/^\d+$/),
});

export const SeatIdParamSchema = z.object({
  seat_id: z.string().regex(/^\d+$/),
});

// ── Bookings ──────────────────────────────────────────────────────────

export const PassengerSchema = z.object({
  id: z.number(),
  booking_id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.string(),
  nationality: z.string().nullable(),
  meal_preference: z.string().nullable(),
  special_assistance: z.string().nullable(),
  seat_id: z.number().nullable(),
});

export const PaymentSchema = z.object({
  id: z.number(),
  booking_id: z.number(),
  amount: z.number(),
  currency: z.string(),
  payment_status: z.string(),
  payment_method: z.string(),
  card_last_four: z.string().nullable(),
  card_type: z.string().nullable(),
  card_holder_name: z.string().nullable(),
  transaction_id: z.string().nullable(),
  paid_at: z.string().nullable(),
});

export const BookingSchema = z.object({
  id: z.number(),
  booking_reference: z.string(),
  user_id: z.number(),
  flight_id: z.number(),
  cabin_class: z.string(),
  total_price: z.number(),
  booking_status: z.string(),
  checked_in: z.number(),
  check_in_time: z.string().nullable(),
  booked_at: z.string(),
  updated_at: z.string(),
});

export const BookingWithDetailsSchema = BookingSchema.extend({
  passengers: z.array(PassengerSchema),
  payment: PaymentSchema.nullable(),
});

export const CreateBookingBodySchema = z.object({
  flight_id: z.number(),
  cabin_class: z.string().optional(),
  passengers: z.array(z.object({
    first_name: z.string(),
    last_name: z.string(),
    date_of_birth: z.string(),
    nationality: z.string().optional().nullable(),
    meal_preference: z.string().optional().nullable(),
    special_assistance: z.string().optional().nullable(),
  })),
});

export const AssignSeatsBodySchema = z.object({
  seat_assignments: z.array(z.object({
    passenger_id: z.number(),
    seat_id: z.number(),
  })),
});

export const BookingRefParamSchema = z.object({
  booking_reference: z.string().min(1),
});

// ── Check-in ──────────────────────────────────────────────────────────

export const BoardingPassSchema = z.object({
  passenger_name: z.string(),
  flight_number: z.string(),
  seat_number: z.string(),
  departure_time: z.string(),
  origin: z.string(),
  destination: z.string(),
  gate: z.string(),
  terminal: z.string(),
});

// ── Claims ────────────────────────────────────────────────────────────

export const ClaimSchema = z.object({
  id: z.number(),
  booking_id: z.number(),
  claim_type: z.string(),
  claim_amount: z.number(),
  claim_reason: z.string(),
  claim_status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateClaimBodySchema = z.object({
  booking_reference: z.string().min(1),
  claim_type: z.string().min(1),
  claim_amount: z.number(),
  claim_reason: z.string().min(1),
});

export const UpdateClaimBodySchema = z.object({
  claim_reason: z.string().optional(),
  claim_amount: z.number().optional(),
});

export const CalculateRefundBodySchema = z.object({
  claim_type: z.string().min(1),
});

export const ClaimIdParamSchema = z.object({
  claim_id: z.string().regex(/^\d+$/),
});

// ── Baggage ───────────────────────────────────────────────────────────

export const BaggageSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  booking_id: z.number().nullable(),
  flight_number: z.string(),
  flight_time: z.string(),
  passenger_name: z.string(),
  passenger_phone: z.string(),
  passenger_email: z.string(),
  baggage_description: z.string(),
  seat_number: z.string().nullable(),
  loss_details: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateBaggageBodySchema = z.object({
  flight_number: z.string().min(1),
  flight_time: z.string().min(1),
  passenger_name: z.string().min(1),
  passenger_phone: z.string().min(1),
  passenger_email: z.string().min(1),
  baggage_description: z.string().min(1),
  seat_number: z.string().optional().nullable(),
  loss_details: z.string().optional().nullable(),
  booking_id: z.number().optional().nullable(),
});

export const ReportIdParamSchema = z.object({
  report_id: z.string().regex(/^\d+$/),
});

// ── Announcements ─────────────────────────────────────────────────────

export const AnnouncementSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  priority: z.string(),
  is_active: z.number(),
  published_at: z.string(),
  expires_at: z.string().nullable(),
});

export const AnnouncementQuerySchema = z.object({
  category: z.string().optional(),
  page: z.string().optional(),
  per_page: z.string().optional(),
});

export const AnnouncementIdParamSchema = z.object({
  announcement_id: z.string().regex(/^\d+$/),
});

// ── FAQ ───────────────────────────────────────────────────────────────

export const FaqSchema = z.object({
  id: z.number(),
  question: z.string(),
  answer: z.string(),
  category: z.string(),
  display_order: z.number(),
  is_active: z.number(),
});

export const FaqQuerySchema = z.object({
  category: z.string().optional(),
});

export const FaqIdParamSchema = z.object({
  faq_id: z.string().regex(/^\d+$/),
});

// ── Info ──────────────────────────────────────────────────────────────

export const RestaurantSchema = z.object({
  id: z.number(),
  name: z.string(),
  cuisine: z.string(),
  location: z.string(),
  rating: z.number(),
  price_range: z.string(),
  hours: z.string(),
});

export const AirportInfoSchema = z.object({
  name: z.string(),
  code: z.string(),
  location: z.string(),
  terminals: z.array(z.string()),
  facilities: z.array(z.string()),
  contact: z.object({
    phone: z.string(),
    email: z.string(),
  }),
});

// ── Mock Services ─────────────────────────────────────────────────────

export const ProcessPaymentBodySchema = z.object({
  booking_id: z.number(),
  card_number: z.string().min(1),
  card_holder: z.string().min(1),
  expiry: z.string().min(1),
  cvv: z.string().min(1),
});

export const EmailNotificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  booking_id: z.number().nullable(),
  email_type: z.string(),
  recipient_email: z.string(),
  subject: z.string(),
  body: z.string(),
  is_read: z.number(),
  sent_at: z.string(),
});

export const CalendarEventSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  event_type: z.string(),
  created_at: z.string(),
});

export const ChatSessionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  session_id: z.string(),
  status: z.string(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
});

export const ChatMessageBodySchema = z.object({
  message: z.string().min(1),
});

export const MockServiceQuerySchema = z.object({
  page: z.string().optional(),
  per_page: z.string().optional(),
  type: z.string().optional(),
  unread_only: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.string().optional(),
});

export const EmailIdParamSchema = z.object({
  email_id: z.string().regex(/^\d+$/),
});

export const SessionIdParamSchema = z.object({
  session_id: z.string().min(1),
});

// ── Profile ───────────────────────────────────────────────────────────

export const ProfileUpdateBodySchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional(),
});
