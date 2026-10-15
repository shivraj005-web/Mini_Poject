const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Country = require("./Country");
const User = require("./User");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "globematch_super_secret_jwt_key_2026";

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Format user object for client responses
const formatUser = (user) => {
  const prefsObj = user.preferences instanceof Map
    ? Object.fromEntries(user.preferences)
    : (user.preferences && typeof user.preferences.toObject === "function" ? user.preferences.toObject() : (user.preferences || {}));

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    preferences: prefsObj,
    activePreset: user.activePreset,
    preferredRegion: user.preferredRegion || "All",
    preferredYear: user.preferredYear || 2026,
    selectedCountry: user.selectedCountry || null
  };
};

// Auth middleware to protect routes
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication token required. Please sign in." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired or invalid token. Please log in again." });
  }
};

// Definition of all 11 evaluation categories with descriptions and icons
const CATEGORIES = [
  {
    key: "Happiness_Rank",
    label: "Happiness & Well-being",
    description: "Subjective well-being, life satisfaction, and happiness of citizens.",
    icon: "😊",
    isTier: false
  },
  {
    key: "Economic_Tier",
    label: "Economic Tier",
    description: "National economic tier categorization (Tier 1 is highest income).",
    icon: "💰",
    isTier: true
  },
  {
    key: "GDP_Per_Capita_Rank",
    label: "GDP Per Capita",
    description: "Gross domestic product per capita, measuring individual wealth.",
    icon: "📈",
    isTier: false
  },
  {
    key: "Human_Development_Rank",
    label: "Human Development (HDI)",
    description: "Composite metric of education, standard of living, and life expectancy.",
    icon: "🎓",
    isTier: false
  },
  {
    key: "Global_Hunger_Rank",
    label: "Food Security & Low Hunger",
    description: "Under-nourishment prevention and robust food security index.",
    icon: "🍲",
    isTier: false
  },
  {
    key: "Life_Expectancy_Rank",
    label: "Healthcare & Longevity",
    description: "Quality public health systems and high life expectancy.",
    icon: "🏥",
    isTier: false
  },
  {
    key: "Global_Peace_Rank",
    label: "Peace & Safety",
    description: "Absence of violence, military conflict, and low crime rates.",
    icon: "🕊️",
    isTier: false
  },
  {
    key: "Democracy_Rank",
    label: "Democracy & Civil Rights",
    description: "Democratic institutional strength, civil liberties, and free elections.",
    icon: "🗳️",
    isTier: false
  },
  {
    key: "Press_Freedom_Rank",
    label: "Press & Media Freedom",
    description: "Freedom of journalists, free press, and governmental transparency.",
    icon: "📰",
    isTier: false
  },
  {
    key: "Corruption_Perception_Rank",
    label: "Low Corruption & Integrity",
    description: "Clean public administration and transparent government institutions.",
    icon: "⚖️",
    isTier: false
  },
  {
    key: "Environmental_Performance_Rank",
    label: "Eco & Environmental Health",
    description: "Clean air, water quality, biodiversity, and environmental protection.",
    icon: "🌿",
    isTier: false
  },
  {
    key: "Gini_Rank",
    label: "Income Equality (Gini)",
    description: "Equitable wealth distribution and low income disparity.",
    icon: "🤝",
    isTier: false
  }
];

// Curated presets to make it easy for users to get started
const PRESETS = [
  {
    id: "peace_safety",
    name: "Peace & Safety",
    icon: "🕊️",
    description: "Prioritizes peaceful living, low corruption, and democratic rights.",
    weights: {
      Global_Peace_Rank: 40,
      Democracy_Rank: 30,
      Happiness_Rank: 20,
      Corruption_Perception_Rank: 10
    }
  },
  {
    id: "economic_powerhouse",
    name: "Economic Powerhouse",
    icon: "💼",
    description: "Focuses on GDP per capita, strong economy tier, and development.",
    weights: {
      GDP_Per_Capita_Rank: 40,
      Economic_Tier: 30,
      Human_Development_Rank: 30
    }
  },
  {
    id: "eco_nature",
    name: "Eco & Nature Living",
    icon: "🌿",
    description: "Prefers top environmental performance, longevity, and well-being.",
    weights: {
      Environmental_Performance_Rank: 45,
      Life_Expectancy_Rank: 30,
      Happiness_Rank: 25
    }
  },
  {
    id: "freedom_rights",
    name: "Freedom & Integrity",
    icon: "🌟",
    description: "Demands press freedom, deep democracy, and zero corruption.",
    weights: {
      Democracy_Rank: 35,
      Press_Freedom_Rank: 35,
      Corruption_Perception_Rank: 30
    }
  },
  {
    id: "quality_of_life",
    name: "Quality of Life",
    icon: "❤️",
    description: "Balanced focus on happiness, healthcare, food security, and peace.",
    weights: {
      Happiness_Rank: 35,
      Life_Expectancy_Rank: 25,
      Global_Hunger_Rank: 20,
      Global_Peace_Rank: 20
    }
  }
];

// Health Check
app.get("/api/health", async (req, res) => {
  try {
    const totalCount = await Country.countDocuments();
    res.json({ status: "ok", totalRecords: totalCount, port: PORT });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Metadata: categories, presets, regions, available years
app.get("/api/meta", async (req, res) => {
  try {
    const regions = await Country.distinct("Region");
    const years = await Country.distinct("Year");

    res.json({
      categories: CATEGORIES,
      presets: PRESETS,
      regions: ["All", ...regions.filter(Boolean).sort()],
      years: years.sort((a, b) => b - a), // latest first
      defaultYear: 2026
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch metadata", details: err.message });
  }
});

// Rank Countries endpoint
app.post("/api/rank-countries", async (req, res) => {
  try {
    const {
      preferences = {},
      year = 2026,
      region = "All",
      limit = 15
    } = req.body;

    // Filter out categories with 0 or negative weight
    const activeWeights = {};
    let totalWeight = 0;

    for (const [key, value] of Object.entries(preferences)) {
      const numVal = parseFloat(value);
      if (!isNaN(numVal) && numVal > 0) {
        activeWeights[key] = numVal;
        totalWeight += numVal;
      }
    }

    if (totalWeight <= 0) {
      return res.status(400).json({
        error: "Please allocate at least 1 point to one or more preference categories."
      });
    }

    // Prepare DB query
    const query = { Year: parseInt(year, 10) || 2026 };
    if (region && region !== "All") {
      query.Region = region;
    }

    const countries = await Country.find(query).lean();

    if (!countries || countries.length === 0) {
      return res.json({
        totalEvaluated: 0,
        results: []
      });
    }

    // Determine max rank for normalization (~217 in dataset)
    const MAX_RANK = 217;

    // Calculate score for each country
    const scoredCountries = countries.map((c) => {
      let weightedScoreSum = 0;
      const breakdown = {};

      for (const [catKey, weight] of Object.entries(activeWeights)) {
        let catScore = 50; // fallback if missing
        const rawVal = c[catKey];

        if (rawVal !== undefined && rawVal !== null) {
          if (catKey === "Economic_Tier") {
            // Tier 1 is best, Tier 4 is worst
            // Map 1 -> 100%, 2 -> 66.7%, 3 -> 33.3%, 4 -> 0%
            const clampedTier = Math.min(Math.max(rawVal, 1), 4);
            catScore = 100 * (1 - (clampedTier - 1) / 3);
          } else {
            // Lower rank is better (1 is best, 217 is worst)
            const clampedRank = Math.min(Math.max(rawVal, 1), MAX_RANK);
            catScore = 100 * (1 - (clampedRank - 1) / (MAX_RANK - 1));
          }
        }

        weightedScoreSum += weight * catScore;
        breakdown[catKey] = {
          raw: rawVal,
          score: Math.round(catScore * 10) / 10,
          weightPercent: Math.round((weight / totalWeight) * 100)
        };
      }

      const matchScore = weightedScoreSum / totalWeight;

      return {
        country: c.Country,
        region: c.Region,
        year: c.Year,
        matchScore: Math.round(matchScore * 10) / 10,
        breakdown,
        allRanks: {
          Economic_Tier: c.Economic_Tier,
          Happiness_Rank: c.Happiness_Rank,
          Global_Hunger_Rank: c.Global_Hunger_Rank,
          Human_Development_Rank: c.Human_Development_Rank,
          GDP_Per_Capita_Rank: c.GDP_Per_Capita_Rank,
          Life_Expectancy_Rank: c.Life_Expectancy_Rank,
          Corruption_Perception_Rank: c.Corruption_Perception_Rank,
          Democracy_Rank: c.Democracy_Rank,
          Gini_Rank: c.Gini_Rank,
          Press_Freedom_Rank: c.Press_Freedom_Rank,
          Global_Peace_Rank: c.Global_Peace_Rank,
          Environmental_Performance_Rank: c.Environmental_Performance_Rank
        }
      };
    });

    // Sort descending by matchScore
    scoredCountries.sort((a, b) => b.matchScore - a.matchScore);

    // Take top results
    const requestedLimit = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 100);
    const topResults = scoredCountries.slice(0, requestedLimit).map((item, index) => ({
      rank: index + 1,
      ...item
    }));

    res.json({
      totalEvaluated: countries.length,
      year: parseInt(year, 10) || 2026,
      region,
      results: topResults
    });
  } catch (error) {
    console.error("Scoring error:", error);
    res.status(500).json({ error: "Failed to rank countries", details: error.message });
  }
});

// ================= AUTH & USER DATA ENDPOINTS ================= //

// User Registration
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, preferences, activePreset, preferredRegion, preferredYear, selectedCountry } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists. Please log in." });
    }

    const hashedPassword = await User.hashPassword(password);

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      preferences: preferences || {},
      activePreset: activePreset || null,
      preferredRegion: preferredRegion || "All",
      preferredYear: preferredYear || 2026,
      selectedCountry: selectedCountry ? {
        country: selectedCountry.country,
        region: selectedCountry.region,
        matchScore: selectedCountry.matchScore,
        rank: selectedCountry.rank,
        savedAt: new Date()
      } : { country: null }
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful! Welcome to GlobeMatch.",
      token,
      user: formatUser(newUser)
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Failed to register account", details: error.message });
  }
});

// User Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful! Welcome back.",
      token,
      user: formatUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to sign in", details: error.message });
  }
});

// Get Current User Profile & Saved Selections
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: formatUser(user) });
  } catch (error) {
    console.error("Auth Me error:", error);
    res.status(500).json({ error: "Failed to retrieve user data", details: error.message });
  }
});

// Save or Update User Priorities and Suitable Country
app.post("/api/user/save-selection", requireAuth, async (req, res) => {
  try {
    const { preferences, activePreset, preferredRegion, preferredYear, selectedCountry } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (preferences !== undefined) {
      user.preferences = preferences;
    }
    if (activePreset !== undefined) {
      user.activePreset = activePreset;
    }
    if (preferredRegion !== undefined) {
      user.preferredRegion = preferredRegion;
    }
    if (preferredYear !== undefined) {
      user.preferredYear = preferredYear;
    }
    if (selectedCountry !== undefined) {
      user.selectedCountry = {
        country: selectedCountry.country || null,
        region: selectedCountry.region || null,
        matchScore: selectedCountry.matchScore || null,
        rank: selectedCountry.rank || null,
        savedAt: selectedCountry.country ? new Date() : null
      };
    }

    await user.save();

    res.json({
      message: "Your preferences and selections have been saved successfully!",
      user: formatUser(user)
    });
  } catch (error) {
    console.error("Save selection error:", error);
    res.status(500).json({ error: "Failed to save selection", details: error.message });
  }
});

// Select / Mark a Country as User's Suitable Country
app.post("/api/user/select-country", requireAuth, async (req, res) => {
  try {
    const { country, region, matchScore, rank, currentPreferences } = req.body;

    if (!country) {
      return res.status(400).json({ error: "Country name is required." });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.selectedCountry = {
      country,
      region: region || null,
      matchScore: matchScore || null,
      rank: rank || null,
      savedAt: new Date()
    };

    // Optionally also update preferences if passed
    if (currentPreferences && Object.keys(currentPreferences).length > 0) {
      user.preferences = currentPreferences;
    }

    await user.save();

    res.json({
      message: `${country} has been chosen as your suitable country!`,
      user: formatUser(user)
    });
  } catch (error) {
    console.error("Select country error:", error);
    res.status(500).json({ error: "Failed to select suitable country", details: error.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`GlobeMatch Backend API running on http://localhost:${PORT}`);
});