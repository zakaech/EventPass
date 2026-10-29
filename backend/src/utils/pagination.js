// Pagination par page/limit : la page 3 avec 10 éléments par page
// correspond à "LIMIT 10 OFFSET 20" en SQL.

function toLimitOffset({ page, limit }) {
  return { limit, offset: (page - 1) * limit };
}

function paginated(data, total, { page, limit }) {
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

module.exports = { toLimitOffset, paginated };
