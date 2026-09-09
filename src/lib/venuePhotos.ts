import type { ImageSourcePropType } from "react-native";

// Curated cover photos for the current seeded venues, spread across all of
// them (not just the ones whose sport happens to match the photo) per an
// explicit choice to prioritize visual variety over sport-accuracy here.
// Keyed by venues.id — falls back to the sport-based photo (sportImages.ts)
// for any venue not listed here (e.g. a venue added later).
const VENUE_PHOTO_OVERRIDES: Record<string, ImageSourcePropType> = {
  "cf0f6f34-9104-45f7-9a14-fb7b9d4e8651": require("../../assets/venue-photos/tennis-ball.jpg"), // Champions Badminton Academy
  "97d4c2f5-ad90-446c-afd7-4f7e0f8937b7": require("../../assets/venue-photos/multi-sport.jpg"), // DHA Sports Complex
  "abd4221d-2345-4b2c-8a34-9dafe7ceb6c9": require("../../assets/venue-photos/padel-court.jpg"), // Elite Sports Arena
  "8f9bfe08-a93c-4892-8b9b-2f50acf0fdc9": require("../../assets/venue-photos/tennis-racket.jpg"), // Islamabad Futsal Club
  "ff566997-1072-40e0-bcb9-df897b793538": require("../../assets/venue-photos/tennis-ball.jpg"), // Karachi Cricket Ground
  "fb757e8b-5d35-4e99-b8b9-68eae982e663": require("../../assets/venue-photos/multi-sport.jpg"), // Usama123
};

export function getVenuePhoto(venueId: string): ImageSourcePropType | null {
  return VENUE_PHOTO_OVERRIDES[venueId] ?? null;
}
