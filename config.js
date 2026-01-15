// Shared configuration for the Jellyfin Community Bot

// Featured projects - developers active on this server
export const FEATURED_PROJECTS = [
    'afinity', 'anchorr', 'jellybuddy', 'jellyfin-enhanced', 'kefin-tweaks',
    'paradox-plugins', 'streamystats'
];

// Embed colors by category
export const COLORS = {
    clients: 0x3498DB,
    plugins: 0x00D4AA,
    services: 0xFF6B35,
    featured: 0xFFD700
};

// Category metadata
export const CATEGORY_INFO = {
    clients: {
        name: 'Third-Party Jellyfin Clients',
        singular: 'Third Party Client',
        iconURL: 'https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png',
        url: 'https://jellyfin.org/clients/',
        command: '/clients'
    },
    plugins: {
        name: 'Jellyfin Plugins',
        singular: 'Plugin',
        iconURL: 'https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png',
        url: 'https://jellyfin.org/docs/general/server/plugins',
        command: '/plugins'
    },
    services: {
        name: 'Jellyfin Services',
        singular: 'Service',
        iconURL: 'https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png',
        url: 'https://jellyfin.org',
        command: '/services'
    }
};

// Check if a project is featured
export function isFeaturedProject(item) {
    return FEATURED_PROJECTS.some(id =>
        item.id.includes(id) || item.name.toLowerCase().includes(id)
    );
}

// Sort items with featured first, then alphabetically
export function sortByFeatured(items) {
    return [...items].sort((a, b) => {
        const aFeatured = isFeaturedProject(a);
        const bFeatured = isFeaturedProject(b);

        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
        return a.name.localeCompare(b.name);
    });
}
