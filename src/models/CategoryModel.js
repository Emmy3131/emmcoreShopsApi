const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      minlength: [2, "Category must be at least 2 characters"],
      maxlength: [50, "Category name must not exceed 15 characters"],
      lowercase: true
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    image: {
      type: String
    },

    description: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// AUTO CREATE SLUG
categorySchema.pre("save", function () {
  this.slug = slugify(this.name, { lower: true });
  // next();
});

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;