# 📦 DeliveryX — Parcel Delivery Management System

DeliveryX is a home/office pickup parcel delivery platform that streamlines booking, tracking, and delivery for **Users**, **Admins**, and **Riders** across Bangladesh. It offers real-time tracking, dynamic pricing, secure OTP/tracking-ID based delivery confirmation, and role-based dashboards for a fast, reliable, and transparent logistics experience.

🔗 **Live Site:** [Add your live client URL here]
🔗 **Server API:** [Add your live server/API URL here]

---

## 🧑‍🤝‍🧑 User Roles

DeliveryX is built around three coordinated roles:

| Role | Responsibilities |
|---|---|
| **User** | Book parcels, pay dynamically-calculated charges, track parcels in real time, and leave reviews after delivery. |
| **Admin** | Assign pickup/delivery riders, manage inter-district routing and service centers, and monitor system-wide operations. |
| **Rider** | Collect and deliver parcels, hand off between service centers for outside-city deliveries, and update parcel status at every stage. |

---

## ✨ Key Features

- 🔐 **Firebase Authentication** with role-based route protection (User / Admin / Rider)
- 📦 **Parcel Booking** with a 3-part form (Parcel Info, Sender Info, Receiver Info) and automatic cost calculation by type, weight, and service center
- 💳 **Stripe Payment Integration** — secure card-based checkout with automatic tracking ID generation on success
- 📍 **Real-Time Parcel Tracking** with a dedicated tracking collection and status history
- 📊 **Role-Specific Dashboards**
  - **User:** parcel states overview, pie chart, unpaid parcels, payment history, reviews
  - **Admin:** system stats, revenue/service-center analytics, user & rider management, delivery routing
  - **Rider:** earnings, pickup/delivery task queues, tracking-ID confirmation flow
- ⭐ **Review System** — users with at least one paid parcel can add, edit, or delete reviews
- 🚚 **Delivery Workflow Engine** — parcel status progresses through `unpaid → paid → ready-to-pickup → in-transit → reached-service-center → shipped → ready-for-delivery → delivered`
- 🧑‍💼 **User & Rider Management** — admins can promote users to admin, and approve/reject rider applications
- 📱 **Fully Responsive UI** with a persistent sidebar layout across all dashboards

---

## 🛠️ Tech Stack

**Client**
- React (Vite)
- React Router
- TanStack Query (React Query)
- Axios (with secured interceptors)
- Tailwind CSS
- Firebase Authentication
- Recharts

**Server**
- Node.js & Express
- MongoDB (native driver)
- Firebase Admin SDK (token verification)
- Stripe (payments)

---

## 📁 Project Structure

This is a two-repository project:

- **Client:** [`Parcel-Delivery-System-Client`](https://github.com/rezuwaann/Parcel-Delivery-System-Client) — React frontend, role-based dashboards, booking & payment flows
- **Server:** [`Parcel-Delivery-System-Server`](https://github.com/rezuwaann/parcel-delivery-system-server) — REST API, auth middleware, payment processing, MongoDB data layer


---

## 🚀 Getting Started

### Client
```bash
git clone https://github.com/rezuwaann/Parcel-Delivery-System-Client
cd Parcel-Delivery-System-Client
npm install
npm run dev
```

### Server
```bash
git clone https://github.com/rezuwaann/parcel-delivery-system-server
cd Parcel-Delivery-System-Server
npm install
npm run dev
```

Make sure MongoDB Atlas access, Firebase service account credentials, and Stripe API keys are configured before starting the server.

---

## 📖 Core Modules

### User Dashboard
- **User Home:** parcel status overview + pie chart + profile card
- **Add Parcel:** door-to-door booking form with live cost calculation
- **Parcel to Pay:** unpaid parcels table with Pay / View / Delete actions
- **Payment Page:** Stripe checkout, tracking ID + tracking doc creation on success
- **Manage Parcel:** search by receiver number, Track & View actions
- **Payment History:** all past payments with relative dates
- **Discussion:** add/edit/delete reviews (only for users with a paid parcel)
- **Settings:** update profile info (name, image, password)

### Admin Dashboard
- **Admin Home:** platform-wide stats, revenue/parcel charts, payment feed
- **Manage Users:** search/filter users, promote/demote admin role
- **Manage Riders:** approve/reject rider applications
- **Delivery Management:** parcel status overview, tracking-ID search, routing actions
- **Manage Parcel Delivery:** step-by-step routing controls (assign pickup, confirm receipt, ship, assign delivery) tied to parcel status

### Rider Dashboard
- **Rider Home:** earnings, pickup/delivery counts, current task list
- **Parcel to PickUp:** confirm pickup via tracking-ID modal, updates status + earnings
- **Parcel to Delivery:** confirm delivery via tracking-ID modal, updates status + earnings

---

## 🔒 Authentication & Authorization

- Firebase ID tokens are sent via `Authorization: Bearer <token>` on every secured request
- Server-side middleware (`verifyFBToken`) validates the token using Firebase Admin SDK
- Protected routes return `401 Unauthorized` for missing/invalid tokens and `403 Forbidden` when a user requests data outside their own scope

---

## 📌 Notes

- Parcel pricing is calculated dynamically based on type (document/non-document), weight, and whether the destination is within or outside the sender's city.
- Every rider action (pickup/delivery confirmation) increases rider earnings by ৳20 per delivery.
- All parcel status changes generate a corresponding tracking document for full delivery history visibility.

