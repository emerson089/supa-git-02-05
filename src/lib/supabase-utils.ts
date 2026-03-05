/**
 * Supabase utility helpers shared across hooks.
 */

/**
 * Fetches all rows from a Supabase query, bypassing the 1000-row default limit
 * by using cursor-based pagination via `.range()`.
 *
 * @param queryBuilder A function that returns a Supabase query builder (without `.range()`)
 * @returns All rows across all pages
 */
export async function fetchAllRows<T>(queryBuilder: () => any): Promise<T[]> {
    const pageSize = 1000;
    let allData: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await queryBuilder().range(
            page * pageSize,
            (page + 1) * pageSize - 1
        );
        if (error) throw error;
        if (data && data.length > 0) {
            allData = [...allData, ...data];
            hasMore = data.length === pageSize;
            page++;
        } else {
            hasMore = false;
        }
    }

    return allData;
}
