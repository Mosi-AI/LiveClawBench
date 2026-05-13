import type { UserData } from "../types.js";

export const DEFAULT_USER: UserData = {
  username: "Peter Griffin",
  gender: "Male",
  address: "1234 Innovation Drive, San Francisco, CA 94105, USA",
  email: "peter.griffin@example.com",
  phone: "11111111111",
  payment_methods: [
    { type: "gift card", account: "GIFT-****-****-7892", balance: "$50.00" },
    { type: "paypal account", account: "peter.griffin@email.com" },
    { type: "credit card", account: "Visa ending in 4532" },
  ],
};
