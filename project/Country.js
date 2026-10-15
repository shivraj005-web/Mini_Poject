const mongoose = require("mongoose");

// MongoDB Connection URI (global_country_rank)
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/global_country_rank";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully:", MONGO_URI);
  })
  .catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
  });

// Schema definition matching global_country_rankings_2000_2026 collection
const countrySchema = new mongoose.Schema({
  Country: { type: String, required: true },
  Year: { type: Number, required: true },
  Region: { type: String, required: true },
  Economic_Tier: { type: Number, default: null },
  Happiness_Rank: { type: Number, default: null },
  Global_Hunger_Rank: { type: Number, default: null },
  Human_Development_Rank: { type: Number, default: null },
  GDP_Per_Capita_Rank: { type: Number, default: null },
  Life_Expectancy_Rank: { type: Number, default: null },
  Corruption_Perception_Rank: { type: Number, default: null },
  Democracy_Rank: { type: Number, default: null },
  Gini_Rank: { type: Number, default: null },
  Press_Freedom_Rank: { type: Number, default: null },
  Global_Peace_Rank: { type: Number, default: null },
  Environmental_Performance_Rank: { type: Number, default: null }
});

// Explicit collection name binding
const Country = mongoose.model("Country", countrySchema, "global_country_rankings_2000_2026");

module.exports = Country;
