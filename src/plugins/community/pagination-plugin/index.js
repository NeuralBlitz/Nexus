export const manifest = {
  name: 'pagination-plugin',
  id: 'pagination-plugin',
  version: '1.0.0',
  description: 'Pagination utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Pagination plugin initialized');
}

export async function activate(context) {
  api.log('Pagination plugin activated');
}

export function deactivate() {
  api.log('Pagination plugin deactivated');
}

export const functions = {
  paginate: (items, page = 1, perPage = 10) => {
    const total = items.length;
    const totalPages = Math.ceil(total / perPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    return {
      data: items.slice(start, end),
      pagination: {
        currentPage,
        perPage,
        total,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null
      }
    };
  },

  cursorPaginate: (items, cursor = null, perPage = 10, getCursor = (item) => item.id) => {
    let startIndex = 0;
    if (cursor) {
      startIndex = items.findIndex(item => getCursor(item) === cursor) + 1;
    }
    const data = items.slice(startIndex, startIndex + perPage);
    return {
      data,
      nextCursor: data.length === perPage ? getCursor(data[data.length - 1]) : null,
      hasMore: startIndex + perPage < items.length
    };
  },

  offsetPaginate: (items, offset = 0, limit = 10) => {
    return {
      data: items.slice(offset, offset + limit),
      offset,
      limit,
      total: items.length,
      hasMore: offset + limit < items.length
    };
  },

  infinitePaginate: (items, page = 1, perPage = 10) => {
    const totalPages = Math.ceil(items.length / perPage);
    const data = items.slice(0, page * perPage);
    return {
      data,
      page,
      perPage,
      hasMore: page < totalPages
    };
  },

  createLinks: (page, totalPages, options = {}) => {
    const { maxLinks = 7, baseUrl = '', paramName = 'page' } = options;
    const links = [];
    let start = Math.max(1, page - Math.floor(maxLinks / 2));
    let end = Math.min(totalPages, start + maxLinks - 1);
    
    if (end - start < maxLinks - 1) {
      start = Math.max(1, end - maxLinks + 1);
    }

    if (start > 1) links.push({ page: 1, url: `${baseUrl}?${paramName}=1`, active: false });
    if (start > 2) links.push({ page: '...', url: null, active: false });

    for (let i = start; i <= end; i++) {
      links.push({ page: i, url: `${baseUrl}?${paramName}=${i}`, active: i === page });
    }

    if (end < totalPages - 1) links.push({ page: '...', url: null, active: false });
    if (end < totalPages) links.push({ page: totalPages, url: `${baseUrl}?${paramName}=${totalPages}`, active: false });

    return links;
  },

  metadata: (page, perPage, total) => {
    const totalPages = Math.ceil(total / perPage);
    return {
      page,
      perPage,
      total,
      totalPages,
      first: 1,
      last: totalPages,
      from: total > 0 ? (page - 1) * perPage + 1 : null,
      to: Math.min(page * perPage, total)
    };
  }
};

export default { manifest, init, activate, deactivate, functions };
