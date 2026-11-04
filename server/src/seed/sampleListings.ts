import { Types } from "mongoose";
import { Listing } from "../models/Listing";

/**
 * Sample listings for local testing and the demo (Aryan).
 *
 * Every sample has a fixed id starting with "5eed", so seeding is safe to run
 * again: it resets the samples and never touches listings people created.
 * Sellers are the test accounts from client/src/lib/devUsers.ts.
 */
const SELLERS = {
  anish: "000000000000000000000001",
  krisha: "000000000000000000000002",
  anuj: "000000000000000000000003",
};

type Sample = {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: "new" | "like_new" | "good" | "fair";
  seller: string;
  status?: "active" | "sold";
};

const SAMPLES: Sample[] = [
  { title: "Calculus: Early Transcendentals, 9th edition", description: "Stewart. Some highlighting in chapters 2 to 4, otherwise clean. Used for Calc I and II.", price: 45, category: "Textbooks", condition: "good", seller: SELLERS.anish },
  { title: "Organic Chemistry textbook with solutions manual", description: "Klein, 4th edition. Both books together. No missing pages.", price: 60, category: "Textbooks", condition: "good", seller: SELLERS.krisha },
  { title: "Intro to Algorithms (CLRS), 4th edition", description: "Hardcover, like new. Bought for Data Structures and barely opened it.", price: 55, category: "Textbooks", condition: "like_new", seller: SELLERS.anuj },
  { title: "Principles of Microeconomics, Mankiw", description: "Required for Intro Micro. Cover is a little bent.", price: 25, category: "Textbooks", condition: "fair", seller: SELLERS.anish },
  { title: "Physics for Scientists and Engineers, Vol 1", description: "Serway. Good for Physics 203. Includes access code card (already used).", price: 30, category: "Textbooks", condition: "good", seller: SELLERS.krisha },
  { title: "Psychology 101 textbook, loose-leaf with binder", description: "Loose-leaf edition, comes in a binder so it stays together.", price: 15, category: "Textbooks", condition: "good", seller: SELLERS.anuj },
  { title: "IKEA desk lamp, warm white bulb included", description: "Adjustable arm, works perfectly. Pickup on College Ave.", price: 12, category: "Furniture", condition: "like_new", seller: SELLERS.anish },
  { title: "Wooden study desk with one drawer", description: "Solid wood, 40 inches wide. You will need a car to pick it up.", price: 40, category: "Furniture", condition: "good", seller: SELLERS.krisha },
  { title: "Moving out: free shoe rack", description: "Three-tier metal shoe rack. Free, just come grab it from Busch.", price: 0, category: "Furniture", condition: "fair", seller: SELLERS.anuj },
  { title: "Ergonomic office chair", description: "Mesh back, adjustable height and armrests. Great for long study sessions.", price: 65, category: "Furniture", condition: "good", seller: SELLERS.anish },
  { title: "Twin XL mattress topper, memory foam", description: "Three inch topper for dorm beds. Washed cover, no stains.", price: 20, category: "Furniture", condition: "good", seller: SELLERS.krisha },
  { title: "Small bookshelf, 3 shelves", description: "White, easy to carry. Holds plenty of textbooks.", price: 18, category: "Furniture", condition: "fair", seller: SELLERS.anuj },
  { title: "Mini fridge, 3.1 cu ft, works great for a dorm", description: "Has a small freezer compartment. Cleaned and defrosted.", price: 70, category: "Appliances", condition: "good", seller: SELLERS.anish },
  { title: "Microwave, 700W compact", description: "Fits on a dorm shelf. Turntable works, all buttons work.", price: 35, category: "Appliances", condition: "good", seller: SELLERS.krisha },
  { title: "Electric kettle, 1.7L", description: "Boils water in about three minutes. Auto shut-off.", price: 10, category: "Appliances", condition: "like_new", seller: SELLERS.anuj },
  { title: "Single-serve coffee maker", description: "Brews one cup at a time. Comes with a reusable filter.", price: 22, category: "Appliances", condition: "good", seller: SELLERS.anish },
  { title: "TI-84 Plus CE graphing calculator", description: "Rechargeable, cable included. Approved for most math exams.", price: 60, category: "Electronics", condition: "fair", seller: SELLERS.krisha },
  { title: "Noise-cancelling headphones", description: "Over-ear, Bluetooth, about 20 hours of battery. Case included.", price: 80, category: "Electronics", condition: "like_new", seller: SELLERS.anuj },
  { title: "27 inch monitor, 1080p", description: "HDMI and DisplayPort. Stand included. No dead pixels.", price: 90, category: "Electronics", condition: "good", seller: SELLERS.anish },
  { title: "Mechanical keyboard, brown switches", description: "Full size with a USB-C cable. A few keycaps are shiny from use.", price: 35, category: "Electronics", condition: "good", seller: SELLERS.krisha },
  { title: "Wireless mouse, still sealed", description: "Got two as gifts. This one has never been opened.", price: 15, category: "Electronics", condition: "new", seller: SELLERS.anuj },
  { title: "Arduino starter kit", description: "Board, breadboard, sensors and jumper wires. Used for one ECE lab.", price: 28, category: "Electronics", condition: "like_new", seller: SELLERS.anish },
  { title: "Sealed lab goggles and coat, size M", description: "Required for chemistry labs. Never worn, still in the bag.", price: 18.5, category: "Supplies", condition: "new", seller: SELLERS.krisha },
  { title: "Engineering drafting kit", description: "Compass, rulers, protractor and mechanical pencils in a case.", price: 12, category: "Supplies", condition: "good", seller: SELLERS.anuj },
  { title: "Pack of 10 notebooks, college ruled", description: "Unused. Bought too many at the start of the semester.", price: 8, category: "Supplies", condition: "new", seller: SELLERS.anish },
  { title: "Rutgers hoodie, size L", description: "Scarlet, official store hoodie. Washed a few times.", price: 20, category: "Clothing", condition: "good", seller: SELLERS.krisha },
  { title: "Winter jacket, men's medium", description: "Warm and waterproof. Good for walking between campuses.", price: 45, category: "Clothing", condition: "like_new", seller: SELLERS.anuj },
  { title: "Road bike, 54cm frame", description: "21 speed. New tires this fall. Lock included.", price: 150, category: "Bikes", condition: "good", seller: SELLERS.anish },
  { title: "Bike helmet, adjustable", description: "Fits most heads. Never been in a crash.", price: 15, category: "Bikes", condition: "good", seller: SELLERS.krisha },
  { title: "Board game bundle: Catan and Codenames", description: "All pieces included. Great for floor game nights.", price: 30, category: "Other", condition: "good", seller: SELLERS.anuj },
  // Sold samples prove the feed hides anything that is not active.
  { title: "Statistics textbook (sold)", description: "Already sold. Should not appear in the feed.", price: 20, category: "Textbooks", condition: "good", seller: SELLERS.anish, status: "sold" },
  { title: "Floor lamp (sold)", description: "Already sold. Should not appear in the feed.", price: 10, category: "Furniture", condition: "fair", seller: SELLERS.krisha, status: "sold" },
];

export const SAMPLE_COUNT = SAMPLES.length;

/** "5eed" followed by the zero-padded index, e.g. 5eed00000000000000000007. */
export function sampleId(index: number) {
  return new Types.ObjectId(`5eed${String(index).padStart(20, "0")}`);
}

const SAMPLE_ID_FILTER = { _id: { $in: SAMPLES.map((_, i) => sampleId(i)) } };

/**
 * Inserts or resets every sample listing. Samples are spread over the last
 * few days (newest first in the list) so date sorting has something to show.
 */
export async function seedSampleListings(now = Date.now()) {
  const HOUR = 60 * 60 * 1000;
  const result = await Listing.bulkWrite(
    SAMPLES.map((sample, i) => {
      const createdAt = new Date(now - (i * 5 + 1) * HOUR);
      return {
        replaceOne: {
          filter: { _id: sampleId(i) },
          replacement: { ...sample, status: sample.status ?? "active", photos: [], seller: new Types.ObjectId(sample.seller), createdAt, updatedAt: createdAt },
          upsert: true,
        },
      };
    }),
    { timestamps: false }
  );
  return { inserted: result.upsertedCount, reset: result.matchedCount };
}

/** Removes only the sample listings. */
export async function removeSampleListings() {
  const { deletedCount } = await Listing.deleteMany(SAMPLE_ID_FILTER);
  return deletedCount;
}
