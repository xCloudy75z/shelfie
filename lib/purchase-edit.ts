/** The set of purchase fields the modal lets the user edit (all as the modal
 *  holds them: strings for inputs, boolean for the offer toggle). */
export type EditableFields = {
  price: string;
  qty: string;
  store: string;
  date: string;
  onOffer: boolean;
};

/** True if any editable field differs from the values the modal opened with.
 *  Drives the "close on backdrop tap only when pristine" guard so an accidental
 *  outside tap (e.g. dismissing the iOS keyboard) can't discard real edits. */
export function isPurchaseDirty(
  initial: EditableFields,
  current: EditableFields,
): boolean {
  return (
    initial.price !== current.price ||
    initial.qty !== current.qty ||
    initial.store !== current.store ||
    initial.date !== current.date ||
    initial.onOffer !== current.onOffer
  );
}
