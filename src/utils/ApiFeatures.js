
class APIFeatures {
  constructor(query, querystr) {
    this.query = query;
    this.querystr = querystr || {};
  }

  filter() {
    const queryObj = { ...this.querystr };

    const excludedFields = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((field) => delete queryObj[field]);

    // Block MongoDB operator injection through query-string keys.
    const removeUnsafeKeys = (value) => {
      if (!value || typeof value !== "object") return;

      for (const key of Object.keys(value)) {
        if (key.startsWith("$") || key.includes(".")) {
          delete value[key];
        } else {
          removeUnsafeKeys(value[key]);
        }
      }
    };

    removeUnsafeKeys(queryObj);

    // Convert gte, gt, lte and lt into MongoDB comparison operators.
    const queryStr = JSON.stringify(queryObj).replace(
      /\b(gte|gt|lte|lt)\b/g,
      (match) => `$${match}`
    );

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  sort() {
    if (this.querystr.sort) {
      const sortBy = String(this.querystr.sort)
        .split(",")
        .map((field) => field.trim())
        .filter((field) => /^-?[a-zA-Z][a-zA-Z0-9_]*$/.test(field))
        .join(" ");

      if (sortBy) {
        this.query = this.query.sort(sortBy);
      }
    } else {
      this.query = this.query.sort("-createdAt");
    }

    return this;
  }

  limitFields() {
    if (this.querystr.fields) {
      const fields = String(this.querystr.fields)
        .split(",")
        .map((field) => field.trim())
        .filter((field) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(field))
        .join(" ");

      if (fields) {
        this.query = this.query.select(fields);
      }
    } else {
      this.query = this.query.select("-__v");
    }

    return this;
  }

  paginate() {
    const parsedPage = Number.parseInt(this.querystr.page, 10);
    const parsedLimit = Number.parseInt(this.querystr.limit, 10);

    const page = Number.isInteger(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

    const requestedLimit =
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : 20;

    const limit = Math.min(requestedLimit, 100);
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
