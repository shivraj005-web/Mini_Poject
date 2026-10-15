# 🌍 GlobeMatch — Intelligent Country Recommendation System

A personalized country recommendation web application built for college mini-project demonstration. The system evaluates and ranks 217 sovereign nations based on individual user priorities across **12 global quality-of-life indices** using a transparent multi-criteria normalization scoring algorithm.

Now equipped with a **User Authentication & Personalization System** that saves individual priority weights and lets users select their **Suitable Country**. When users log in again, the application automatically restores their priorities and prominently displays: **"⭐ That is your previous selection"**.

---

## 📌 Table of Contents
- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [User Authentication & Persistence](#-user-authentication--persistence)
- [Technology Stack](#-technology-stack)
- [System Architecture & Data Flow](#-system-architecture--data-flow)
- [Mathematical Scoring Algorithm](#-mathematical-scoring-algorithm)
- [Dataset & Evaluated Indices](#-dataset--evaluated-indices)
- [Project Structure](#-project-structure)
- [Installation & How to Run](#-installation--how-to-run)
- [API Endpoints](#-api-endpoints)

---

## 📖 Project Overview

Different individuals prioritize different aspects when choosing where to live, study, or relocate—some prioritize **peace and safety**, others **economic earning power**, **healthcare**, or **environmental quality**. 

**GlobeMatch** addresses this by letting users distribute a **budget of 100 preference points** across the indices they care about most. Instead of simply sorting by a single metric (like happiness), the backend calculates a weighted composite suitability match percentage for every country in MongoDB, delivering an explainable, personalized recommendation list.

Registered users can save their prioritized criteria, pick their **Suitable Country**, and on subsequent logins see their previously saved destination and indicators restored immediately.

---

## ✨ Key Features

1. **Interactive 100-Point Budget System**:
   - Visual gauge tracking allocated points (`X / 100`).
   - Real-time status feedback: Green (100% balanced), Amber (remaining points left), Red (excess points).
2. **1-Click Curated Presets**:
   - 🕊️ **Peace & Safety**: Focus on peace, democratic rights, and low corruption.
   - 💼 **Economic Powerhouse**: Focus on GDP per capita, high economic tier, and HDI.
   - 🌿 **Eco & Nature Living**: Focus on environmental performance and longevity.
   - 🌟 **Freedom & Integrity**: Focus on press freedom, democracy, and public integrity.
   - ❤️ **Quality of Life**: Balanced distribution across health, happiness, and food security.
3. **Smart Balancing Tools**:
   - **Scale to 100**: Proportionally normalizes custom preference numbers to total exactly 100 points.
   - **Fill Remainder**: Automatically adds unallocated points to your active category.
   - **Reset**: Instantly resets all sliders to 0.
4. **Transparent Country Recommendations**:
   - Ranked country cards with podium tags (`#1`, `#2`, `#3`).
   - Suitability match percentage (e.g. `98.7%`).
   - Breakdown progress bars showing how each country scored in each user priority.
   - **"View All 12 Indicators" Modal** for deep-dive inspection into all raw country statistics.
5. **Filters & Time Travel**:
   - Filter by continent/region (*Asia, Europe, Africa, North America, South America, Oceania*).
   - Historical time selector (*Year 2000 to 2026, default 2026*).

---

## 🔐 User Authentication & Persistence

### 1. Account Management (Registration & Sign In)
- Secure registration and login modal with form validation.
- Password hashing using **`bcryptjs`** (salt rounds = 10).
- Stateless authorization using **JSON Web Tokens (JWT)** persisted in `localStorage`.
- Persistent session restoration upon page refresh via `GET /api/auth/me`.

### 2. Suitable Country Selection
- Users can click **`☆ Select as Suitable`** directly on any country card or from within the indicator details modal.
- Active selection updates to **`★ Suitable Country ✓`** with an emerald border and a **`★ YOUR SELECTED SUITABLE COUNTRY`** badge.
- The top navigation bar displays a quick pill indicator: `⭐ Suitable Country: [Country Name] ([Match Score]%)`.

### 3. "That is your previous selection" on Return
- When a user logs in again, a prominent banner appears at the top:
  > **"⭐ That is your previous selection"**
- Displays their saved suitable country, continent, match score, and saved timestamp.
- Displays visual tags of all user-prioritized indices and their allocated points.
- Automatically restores their saved priority weights back into the interactive sliders and refreshes recommendations.
- Allows one-click **"View Suitable Country Details"** or **"Reset Sliders to Saved"**.
- Users can update their priority profile at any time by clicking **"💾 Save Priorities"**.

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 19 + Vite | Fast, responsive single-page application |
| **Styling** | Vanilla CSS | Custom, soft minimalist aesthetic with glassmorphism |
| **Backend** | Node.js + Express 5 | REST API server with ranking, scoring & auth logic |
| **Authentication**| JWT + bcryptjs | Secure password hashing and token-based sessions |
| **Database** | MongoDB (Local) | Stores country rankings and registered user profiles |
| **ODM** | Mongoose 9 | Schemas for `Country` and `User` models |

---

## 🔄 System Architecture & Data Flow

```mermaid
graph TD
    User([User Browser]) -->|1. Sign Up / Sign In| Frontend[React 19 + Vite<br/>localhost:5173]
    Frontend -->|2. POST /api/auth/*| Backend[Express 5 API Server<br/>localhost:5000]
    Backend -->|3. Query / Persist User| DB[(MongoDB<br/>global_country_rank)]
    DB -->|4. Return User Profile & Preferences| Backend
    Backend -->|5. JWT Token + Stored Data| Frontend
    Frontend -->|6. Display 'That is your previous selection'| User

    Frontend -->|7. POST /api/rank-countries<br/>(Restored/Custom Weights)| Backend
    Backend -->|8. Fetch Year 2026 Records| DB
    DB -->|9. 217 Country Documents| Backend
    Backend -->|10. Normalization & Weighted Math| Backend
    Backend -->|11. Sorted Results with Match %| Frontend
    Frontend -->|12. Highlight Suitable Country Card| User
```

---

## 📐 Mathematical Scoring Algorithm

In international rankings, a lower number represents a better performance (Rank `1` is the best in the world, while Rank `217` is the lowest).

### 1. Metric Score Normalization ($S_i \in [0, 100]$):
For standard ranks (1 to 217):
$$\text{Score}_i = 100 \times \left(1 - \frac{\text{Rank}_i - 1}{\text{MaxRank} - 1}\right)$$
- If a country has **Rank 1**: $\text{Score} = 100\%$
- If a country has **Rank 217**: $\text{Score} = 0\%$

For categorical **Economic Tier** (Tier 1 = High income, Tier 4 = Low income):
$$\text{Score}_{\text{Tier}} = 100 \times \left(1 - \frac{\text{Tier} - 1}{3}\right)$$
- Tier 1: $100\%$ | Tier 2: $66.7\%$ | Tier 3: $33.3\%$ | Tier 4: $0\%$

### 2. Weighted Composite Suitability Match ($M$):
$$\text{SuitabilityMatch} = \frac{\sum_{i=1}^{12} (W_i \times \text{Score}_i)}{\sum_{i=1}^{12} W_i}$$
Where $W_i$ is the user's allocated points for category $i$.

Countries are sorted in descending order of $\text{SuitabilityMatch}$.

---

## 📊 Dataset & Evaluated Indices

The database contains data across **12 global indices**:
1. `Happiness_Rank`: World Happiness Report evaluation
2. `Economic_Tier`: World Bank economic tier classification
3. `GDP_Per_Capita_Rank`: Individual gross domestic product & wealth
4. `Human_Development_Rank`: UN Human Development Index (HDI)
5. `Global_Hunger_Rank`: Food security & nutrition
6. `Life_Expectancy_Rank`: Healthcare access & life expectancy
7. `Global_Peace_Rank`: Global Peace Index (absence of violence/conflict)
8. `Democracy_Rank`: Democratic institutions & political rights
9. `Press_Freedom_Rank`: Reporters Without Borders press freedom index
10. `Corruption_Perception_Rank`: Transparency International CPI
11. `Environmental_Performance_Rank`: Yale EPI environmental health & ecosystem
12. `Gini_Rank`: Income equality & low wealth gap

---

## 📁 Project Structure

```text
Mini_Poject/
├── client/                                 # React Frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                         # Main Application Component (UI, Auth & Selection)
│   │   ├── index.css                       # Design System & Aesthetic Styling
│   │   ├── App.css                         # Supporting component CSS
│   │   └── main.jsx                        # React root mount
│   ├── index.html                          # HTML entry point with SEO metadata
│   ├── vite.config.js                      # Vite config with backend proxy (/api)
│   └── package.json                        # Frontend dependencies
│
├── project/                                # Express Backend
│   ├── Country.js                          # Mongoose model for Country rankings
│   ├── User.js                             # Mongoose model for User accounts & saved selections
│   └── index.js                            # Express API, auth handlers & scoring logic
│
├── global_country_rankings_2000_2026.csv   # Source dataset (5,859 rows)
├── package.json                            # Root package & server scripts
└── README.md                               # Project documentation
```

---

## 🚀 Installation & How to Run

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) installed and running on `localhost:27017`

### 1. Install Backend Dependencies
In the root directory (`Mini_Poject/`):
```bash
npm install
```

### 2. Install Frontend Dependencies
```bash
cd client
npm install
cd ..
```

### 3. Start the Application

Open **two terminal windows**:

#### **Terminal 1: Start Backend API**
```bash
npm run dev
```
*Server starts at `http://localhost:5000` with native watch mode and connects to MongoDB.*

#### **Terminal 2: Start Frontend**
```bash
cd client
npm run dev
```
*Frontend starts at `http://localhost:5173`.*

Open your browser and navigate to:
👉 **`http://localhost:5173`**

---

## 📡 API Endpoints

### 1. Health & Metadata
- **`GET /api/health`**: Checks server status and MongoDB connection count.
- **`GET /api/meta`**: Returns metadata (12 categories, curated presets, regions, and evaluation years).

### 2. Authentication & User Profile
- **`POST /api/auth/register`**:
  - Request body: `{ name, email, password, preferences, selectedCountry, ... }`
  - Creates user, hashes password, and returns `{ token, user }`.
- **`POST /api/auth/login`**:
  - Request body: `{ email, password }`
  - Authenticates credentials and returns `{ token, user }` including saved preferences and previous suitable country.
- **`GET /api/auth/me`**:
  - Header: `Authorization: Bearer <token>`
  - Restores active user session and saved data.

### 3. User Preferences & Selection
- **`POST /api/user/save-selection`**:
  - Header: `Authorization: Bearer <token>`
  - Request body: `{ preferences, activePreset, preferredRegion, preferredYear }`
  - Updates and saves the user's customized priority points.
- **`POST /api/user/select-country`**:
  - Header: `Authorization: Bearer <token>`
  - Request body: `{ country, region, matchScore, rank }`
  - Saves the user's chosen suitable country destination.

### 4. Recommendation Engine
- **`POST /api/rank-countries`**:
  - Computes ranked recommendations based on preferences.
  - **Request Body**:
    ```json
    {
      "preferences": {
        "Happiness_Rank": 40,
        "Global_Peace_Rank": 30,
        "GDP_Per_Capita_Rank": 30
      },
      "year": 2026,
      "region": "All",
      "limit": 25
    }
    ```
  - **Response**:
    ```json
    {
      "totalEvaluated": 217,
      "year": 2026,
      "region": "All",
      "results": [
        {
          "rank": 1,
          "country": "Norway",
          "region": "Europe",
          "matchScore": 98.7,
          "breakdown": { ... },
          "allRanks": { ... }
        }
      ]
    }
    ```

---

## 🎓 Academic Credit & Author
- **Course**: College Mini-Project (MERN Stack / Full Stack Web Development)
- **Domain**: Data-Driven Decision Systems / Recommendation Engines
