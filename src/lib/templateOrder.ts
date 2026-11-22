/**
 * Writing a new order for a template's exercises without tripping its own
 * uniqueness rule.
 *
 * `template_exercises` has a unique index on (template_id, order_index), added
 * with superset groups on 2026-08-29. Each update is checked on its own, so a
 * straightforward "set every row to its new index" fails the moment two rows
 * swap: the first update lands on an index the second row still holds. A
 * template with an exercise moved up a place could not be saved (EZ-51).
 *
 * So a reorder is written in two passes. The first moves every row whose index
 * changes to a parking slot well clear of any real index; the second moves
 * each one from there to where it belongs. A row whose index is unchanged is
 * not touched, and no write in either pass can land on an index another row
 * still holds.
 *
 * Pure, so the app's template editor and the MCP server share one plan and it
 * can be tested without a database.
 */

/** Far above any real position, and still a comfortable 32-bit integer. */
export const PARKING_OFFSET = 1_000_000;

export interface PlacedRow {
  id: string;
  order_index: number;
  superset_group?: number | null;
}

export interface OrderWrite {
  id: string;
  order_index: number;
  superset_group: number | null;
}

export interface OrderPlan {
  /** Run first, every write in it before any of the second. */
  park: Array<{ id: string; order_index: number }>;
  /** Final positions and pairings. */
  place: OrderWrite[];
}

/**
 * @param current rows as they are stored now
 * @param desired the same rows in their new order, with the superset group
 *                each should end up with. Index in this array is the new
 *                order_index.
 */
export function planReorder(current: PlacedRow[], desired: Array<{ id: string; superset_group?: number | null }>): OrderPlan {
  const before = new Map(current.map((row) => [row.id, row]));

  if (desired.length !== current.length || desired.some((row) => !before.has(row.id))) {
    // Silently dropping or inventing a row here would be a delete or an
    // orphan written as a reorder. Callers insert and delete separately.
    throw new Error('planReorder needs exactly the rows that are stored, in a new order.');
  }

  const park: OrderPlan['park'] = [];
  const place: OrderPlan['place'] = [];

  desired.forEach((row, index) => {
    const was = before.get(row.id)!;
    const group = row.superset_group ?? null;
    const moves = was.order_index !== index;

    if (moves) park.push({ id: row.id, order_index: PARKING_OFFSET + index });
    if (moves || (was.superset_group ?? null) !== group) {
      place.push({ id: row.id, order_index: index, superset_group: group });
    }
  });

  return { park, place };
}
