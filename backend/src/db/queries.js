// Fixed aliases p (properties), u (owner). Reuse this predicate in M4 reads.
// M4 must also lock/recheck the property in transactions creating viewings.
export const PUBLIC_PROPERTY = `p.visibility_status='published' AND p.availability_status='available'
  AND (p.expires_at IS NULL OR p.expires_at > now()) AND u.account_status='active'`;
export const propertySelect = `SELECT p.* FROM properties p JOIN users u ON u.id=p.owner_id`;
export const propertyFields = Object.freeze({ title: 'title', description: 'description', monthlyRent: 'monthly_rent', deposit: 'deposit', bedrooms: 'bedrooms', neighbourhood: 'neighbourhood', landmarks: 'landmarks', waterAvailable: 'water_available', parkingAvailable: 'parking_available', moveInDate: 'move_in_date' });
