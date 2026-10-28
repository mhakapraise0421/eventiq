import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./password";
import { ticketCode } from "./format";

type SQLValue = null | number | bigint | string | Uint8Array;

function insert(db: DatabaseSync, table: string, values: Record<string, SQLValue>) {
  const cols = Object.keys(values);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols
    .map(() => "?")
    .join(", ")})`;
  db.prepare(sql).run(...cols.map((c) => values[c]));
}

const img = (prompt: string, size = "portrait_4_3") =>
  `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt,
  )}&image_size=${size}`;

function addDays(base: Date, days: number, hour = 18, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dayKey(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addNextFriday(base: Date, hour = 19, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + ((5 - d.getDay()) % 7 + 7) % 7);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function makeRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function demoPdf(title: string, lines: string[]) {
  const escape = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = [title, "", ...lines]
    .map((line, index) => {
      const size = index === 0 ? 16 : 11;
      const y = 760 - index * 28;
      return `BT /F1 ${size} Tf 56 ${y} Td (${escape(line)}) Tj ET`;
    })
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

interface TierSeed {
  id: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  maxPerOrder?: number;
  perks?: string;
}

interface EventSeed {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  city: string;
  venue: string;
  address: string;
  organizer: string;
  status: string;
  featured: number;
  start: string;
  end: string;
  image: string;
  ageLimit?: string;
  tiers: TierSeed[];
}

export function seedDatabase(db: DatabaseSync) {
  const now = new Date();
  const password = hashPassword("demo1234");
  const created = addDays(now, -80, 9, 0);

  db.exec("BEGIN IMMEDIATE");
  try {
    const users: Array<{
      id: string;
      email: string;
      name: string;
      phone: string;
      city: string;
      role: string;
    }> = [
      {
        id: "usr_attendee",
        email: "attendee@eventiq.co.zw",
        name: "Tino Moyo",
        phone: "+263 77 100 2001",
        city: "Harare",
        role: "attendee",
      },
      {
        id: "usr_org1",
        email: "organizer@eventiq.co.zw",
        name: "Tarisai Chikafu",
        phone: "+263 77 200 3002",
        city: "Harare",
        role: "organizer",
      },
      {
        id: "usr_org2",
        email: "events@zimlive.co.zw",
        name: "Kudakwashe Ncube",
        phone: "+263 71 300 4003",
        city: "Bulawayo",
        role: "organizer",
      },
      {
        id: "usr_applicant1",
        email: "neworganizer@eventiq.co.zw",
        name: "Rudo Mutasa",
        phone: "+263 78 400 5004",
        city: "Harare",
        role: "organizer",
      },
      {
        id: "usr_applicant2",
        email: "mbarearts@eventiq.co.zw",
        name: "Farai Dube",
        phone: "+263 77 500 6005",
        city: "Harare",
        role: "organizer",
      },
      {
        id: "usr_gate",
        email: "gate@eventiq.co.zw",
        name: "Blessing Sibanda",
        phone: "+263 77 600 7006",
        city: "Harare",
        role: "gate",
      },
      {
        id: "usr_admin",
        email: "admin@eventiq.co.zw",
        name: "Nyasha Chari",
        phone: "+263 77 700 8007",
        city: "Harare",
        role: "admin",
      },
      {
        id: "usr_ceo",
        email: "ceo@eventiq.co.zw",
        name: "Praise Mhaka",
        phone: "+263 77 800 9008",
        city: "Harare",
        role: "ceo",
      },
      {
        id: "usr_artist1",
        email: "artist@eventiq.co.zw",
        name: "Tafara Moyo",
        phone: "+263 77 900 1009",
        city: "Harare",
        role: "artist",
      },
      {
        id: "usr_artist2",
        email: "dj@eventiq.co.zw",
        name: "Kudzai Mhaka",
        phone: "+263 71 100 2010",
        city: "Bulawayo",
        role: "artist",
      },
      {
        id: "usr_artist3",
        email: "talent@eventiq.co.zw",
        name: "Nyari Chikomo",
        phone: "+263 78 200 3011",
        city: "Harare",
        role: "artist",
      },
    ];

    const attendeeNames = [
      "Anesu Banda",
      "Tanaka Zhou",
      "Lisa Mupfumi",
      "Kundai Marufu",
      "Shamiso Ndlovu",
      "Tafadzwa Gumbo",
      "Nokutenda Moyo",
      "Brian Chiweshe",
      "Rutendo Nyathi",
      "Munashe Kaseke",
      "Chipo Mandizha",
      "Tatenda Mhlanga",
    ];
    attendeeNames.forEach((name, i) => {
      users.push({
        id: `usr_guest${i + 1}`,
        email: `guest${i + 1}@example.co.zw`,
        name,
        phone: `+263 77 ${String(1100 + i)} ${String(2100 + i)}`,
        city: i % 3 === 0 ? "Bulawayo" : "Harare",
        role: "attendee",
      });
    });

    for (const u of users) {
      insert(db, "users", {
        id: u.id,
        email: u.email,
        password_hash: password,
        name: u.name,
        phone: u.phone,
        city: u.city,
        role: u.role,
        status: "active",
        created_at: created,
      });
    }

    const profiles = [
      {
        user_id: "usr_org1",
        business_name: "Chipaz Live",
        business_type: "Event promoter",
        registration_no: "ZW-REG-48291",
        city: "Harare",
        website: "https://chipazlive.example",
        description:
          "Harare-based concert and festival promoter running premium live music experiences across Zimbabwe since 2018.",
        status: "approved",
        reviewed_by: "usr_ceo",
        reviewed_at: addDays(now, -60, 11),
      },
      {
        user_id: "usr_org2",
        business_name: "Zim Live Events",
        business_type: "Event management company",
        registration_no: "ZW-REG-77104",
        city: "Bulawayo",
        website: "https://zimlive.example",
        description:
          "Full-service event management for corporate conferences, cultural ceremonies and campus festivals.",
        status: "approved",
        reviewed_by: "usr_ceo",
        reviewed_at: addDays(now, -52, 14),
      },
      {
        user_id: "usr_applicant1",
        business_name: "Golden Gate Promotions",
        business_type: "Promoter",
        registration_no: "ZW-REG-99021",
        city: "Harare",
        website: "https://goldengate.example",
        description:
          "New promoter focused on amapiano and all-white parties. Applying for organizer publishing access.",
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
      },
      {
        user_id: "usr_applicant2",
        business_name: "Mbare Arts Collective",
        business_type: "Community arts organisation",
        registration_no: null,
        city: "Harare",
        website: null,
        description:
          "Community arts collective running youth poetry and theatre events. Awaiting updated KYC documentation.",
        status: "requires_modification",
        reviewed_by: "usr_admin",
        reviewed_at: addDays(now, -4, 10),
      },
    ];

    for (const p of profiles) {
      insert(db, "organizer_profiles", {
        user_id: p.user_id,
        business_name: p.business_name,
        business_type: p.business_type,
        registration_no: p.registration_no,
        city: p.city,
        website: p.website,
        description: p.description,
        kyc_document: "company-registration.pdf",
        status: p.status,
        decision_note:
          p.status === "requires_modification"
            ? "Please upload a valid certificate of incorporation and a director ID."
            : null,
        reviewed_by: p.reviewed_by,
        reviewed_at: p.reviewed_at,
        created_at: addDays(now, -65, 9),
      });
    }

    const artistProfiles = [
      {
        user_id: "usr_artist1",
        slug: "tafara",
        stage_name: "TAFARA",
        category: "Musician",
        genres: "Afrobeats,Afro-soul,Contemporary",
        bio: "TAFARA is a Harare-born vocalist and songwriter blending Afro-soul with contemporary Zimbabwean pop. Known for a live band show that moves between acoustic ballads and high-energy grooves, he has headlined stages at the Harare International Festival of the Arts and toured regionally.",
        city: "Harare",
        region: "Harare",
        profile_image: img("portrait of a Zimbabwean male soul singer on stage, dramatic purple stage light, confident, editorial photo", "square"),
        cover_image: img("concert stage with purple and cyan lighting, silhouetted crowd, atmospheric haze", "landscape_16_9"),
        website: "https://tafara.example",
        instagram: "https://instagram.com/tafara.example",
        facebook: null,
        x: null,
        tiktok: null,
        youtube: "https://youtube.com/@tafara.example",
        media_json: JSON.stringify([
          { label: "Live at HIFA 2024", url: "https://youtube.com/watch?v=tafara-hifa" },
          { label: "Studio session: Moyo Wangu", url: "https://youtube.com/watch?v=tafara-moyo" },
        ]),
        performance_history:
          "HIFA 2024 main stage (Harare)\nZimfest Live 2023 (Bulawayo)\nCorporate gala, Meikles Hotel 2023\nMonthly residency, The Book Cafe 2022–2023",
        availability_note: "Available for weekend bookings across Zimbabwe, two weeks' notice preferred.",
        booking_prefs: "Festivals, corporate galas, private celebrations. Outdoor stages welcome.",
        technical_rider: "Full band (6-piece) or acoustic trio. Requires 4 vocal mics, DI for keys, and a 60-minute soundcheck.",
        visibility: "published",
        verification_status: "verified",
        accepting_bookings: 1,
        created_at: addDays(now, -70, 10),
        updated_at: addDays(now, -12, 16),
      },
      {
        user_id: "usr_artist2",
        slug: "dj-kudzai",
        stage_name: "DJ Kudzai",
        category: "DJ",
        genres: "Amapiano,House,Hip-hop",
        bio: "Bulawayo-based open-format DJ playing amapiano, afro-house and hip-hop at clubs, weddings and campus events. Resident at The Basement for two years, with a reputation for reading a crowd and keeping a dancefloor moving from first track to last.",
        city: "Bulawayo",
        region: "Bulawayo",
        profile_image: img("portrait of a female Zimbabwean DJ behind turntables, purple club lighting, editorial photo", "square"),
        cover_image: img("nightclub dancefloor with cyan and purple lights, hands raised, motion blur", "landscape_16_9"),
        website: null,
        instagram: "https://instagram.com/djkudzai.example",
        facebook: "https://facebook.com/djkudzai.example",
        x: null,
        tiktok: "https://tiktok.com/@djkudzai.example",
        youtube: null,
        media_json: JSON.stringify([
          { label: "Amapiano mix — Summer 2025", url: "https://soundcloud.com/djkudzai.example/summer" },
        ]),
        performance_history:
          "Resident DJ, The Basement (Bulawayo) 2023–2025\nNUST Freshers' Party 2024\nAmapiano Sundays, Bulawayo 2024",
        availability_note: "Club and event bookings in Bulawayo and Harare. Travel negotiable.",
        booking_prefs: "Clubs, weddings, campus events, private parties.",
        technical_rider: "2 CDJs and a 4-channel mixer, or bring own controller. Needs booth monitors.",
        visibility: "published",
        verification_status: "pending",
        accepting_bookings: 1,
        created_at: addDays(now, -28, 9),
        updated_at: addDays(now, -3, 21),
      },
      {
        user_id: "usr_artist3",
        slug: "nyari-chikomo",
        stage_name: "Nyari Chikomo",
        category: "Comedian",
        genres: "Stand-up,Spoken word",
        bio: "Stand-up comedian and spoken-word performer working the Harare open-mic circuit. Nyari writes about family, city life and the small absurdities of Zimbabwean daily routines, and is building a first full-length set.",
        city: "Harare",
        region: "Harare",
        profile_image: img("portrait of a Zimbabwean comedian on a small stage with a microphone, warm light, editorial photo", "square"),
        cover_image: null,
        website: null,
        instagram: "https://instagram.com/nyari.example",
        facebook: null,
        x: "https://x.com/nyari.example",
        tiktok: null,
        youtube: null,
        media_json: "[]",
        performance_history: "Open-mic nights, House of Hunger (Harare) 2024–2025\nCorporate year-end function, 2024",
        availability_note: null,
        booking_prefs: "Comedy nights, corporate functions, mixed variety shows.",
        technical_rider: "Handheld mic, mic stand and a small stage light. 15-minute soundcheck.",
        visibility: "draft",
        verification_status: "requires_info",
        accepting_bookings: 1,
        created_at: addDays(now, -10, 15),
        updated_at: addDays(now, -4, 11),
      },
    ];

    for (const p of artistProfiles) {
      insert(db, "artist_profiles", p);
    }

    const artistVerifications = [
      {
        id: "avr_tafara_1",
        artist_id: "usr_artist1",
        status: "verified",
        note: "Identity documents and performance evidence attached.",
        decision_note: "Documents matched and performance history confirmed. Verified.",
        reviewed_by: "usr_admin",
        reviewed_at: addDays(now, -30, 12),
        created_at: addDays(now, -33, 9),
      },
      {
        id: "avr_kudzai_1",
        artist_id: "usr_artist2",
        status: "pending",
        note: "Submitted national ID and a residency confirmation letter.",
        decision_note: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: addDays(now, -3, 21),
      },
      {
        id: "avr_nyari_1",
        artist_id: "usr_artist3",
        status: "requires_info",
        note: "Uploaded a phone bill as proof of identity.",
        decision_note:
          "Please upload a national ID or passport instead, and a document confirming at least one paid performance.",
        reviewed_by: "usr_admin",
        reviewed_at: addDays(now, -4, 10),
        created_at: addDays(now, -8, 14),
      },
    ];

    for (const request of artistVerifications) {
      insert(db, "artist_verification_requests", request);
    }

    const docsRoot =
      process.env.PRIVATE_STORAGE_PATH || path.join(process.cwd(), ".data", "private");
    const artistDocs = [
      {
        id: "doc_tafara_id",
        artist_id: "usr_artist1",
        verification_id: "avr_tafara_1",
        label: "National ID",
        file_name: "tafara-national-id-demo.pdf",
        lines: ["Demo identity document", "Not a real national ID.", "Generated for the EventIQ demo database."],
        uploaded_at: addDays(now, -33, 9),
      },
      {
        id: "doc_tafara_evidence",
        artist_id: "usr_artist1",
        verification_id: "avr_tafara_1",
        label: "Performance evidence",
        file_name: "tafara-performance-letter-demo.pdf",
        lines: ["Demo performance confirmation", "HIFA 2024 main stage booking letter.", "Generated for the EventIQ demo database."],
        uploaded_at: addDays(now, -33, 9),
      },
      {
        id: "doc_kudzai_id",
        artist_id: "usr_artist2",
        verification_id: "avr_kudzai_1",
        label: "National ID",
        file_name: "kudzai-national-id-demo.pdf",
        lines: ["Demo identity document", "Not a real national ID.", "Generated for the EventIQ demo database."],
        uploaded_at: addDays(now, -3, 21),
      },
      {
        id: "doc_nyari_id",
        artist_id: "usr_artist3",
        verification_id: "avr_nyari_1",
        label: "Proof of address",
        file_name: "nyari-utility-bill-demo.pdf",
        lines: ["Demo utility bill", "Not a real document.", "Generated for the EventIQ demo database."],
        uploaded_at: addDays(now, -8, 14),
      },
    ];

    for (const doc of artistDocs) {
      const bytes = demoPdf(doc.label, doc.lines);
      const relative = `artist-docs/${doc.artist_id}/${doc.id}.pdf`;
      const target = path.join(docsRoot, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
      insert(db, "artist_documents", {
        id: doc.id,
        artist_id: doc.artist_id,
        verification_id: doc.verification_id,
        label: doc.label,
        file_name: doc.file_name,
        mime: "application/pdf",
        size: bytes.length,
        storage_path: relative.replace(/\\/g, "/"),
        sha256: createHash("sha256").update(bytes).digest("hex"),
        uploaded_at: doc.uploaded_at,
      });
    }

    const events: EventSeed[] = [
      {
        id: "evt_fridaylive",
        slug: "friday-night-live-acoustic-sessions",
        title: "Friday Night Live: Acoustic Sessions",
        tagline: "Unplugged Zimbabwean favourites with a full band under the stars.",
        description:
          "Friday Night Live is an intimate open-air concert in the Zimbabwe German Society Gardens. A house band reworks Zimbabwean classics and current hits acoustically, with guest vocalists between sets.\n\nGates open at 18:00 and the music starts at 19:00. Food trucks and a full bar are on site. Low chairs and picnic blankets welcome in the lawn area.\n\nEarly Bird tickets are strictly limited.",
        category: "Concerts",
        city: "Harare",
        venue: "Zimbabwe German Society Gardens",
        address: "Adylinn Road, Eastlea, Harare",
        organizer: "usr_org1",
        status: "approved",
        featured: 0,
        start: addNextFriday(now, 19),
        end: addNextFriday(now, 23),
        image: "/images/vibe-concerts.png",
        ageLimit: "All ages",
        tiers: [
          {
            id: "tt_friday_early",
            name: "Early Bird",
            description: "Limited release lawn access.",
            price: 1000,
            capacity: 80,
            perks: "Lawn access",
          },
          {
            id: "tt_friday_ga",
            name: "General Admission",
            description: "Full evening of acoustic sessions.",
            price: 1500,
            capacity: 220,
            perks: "Garden access · All sets",
          },
        ],
      },
      {
        id: "evt_neon",
        slug: "neon-nights-harare",
        title: "Neon Nights: Harare",
        tagline: "The city's biggest night of afro-house, amapiano and neon lights.",
        description:
          "Neon Nights returns to HICC Arena for one electric night. Three stages, a heavyweight line-up of Zimbabwean and regional DJs, and a production built around immersive light design.\n\nDoors open at 19:00 with the main arena programme starting at 21:00. VIP ticket holders get fast-lane entry, access to the elevated deck and one complimentary drink. VVIP tables seat six guests and include bottle service and a dedicated host.\n\nThis is an 18+ event. Valid identification is required at the gate, even if you hold a valid ticket.",
        category: "Nightlife",
        city: "Harare",
        venue: "HICC Arena",
        address: "Samora Machel Avenue, Harare CBD",
        organizer: "usr_org1",
        status: "approved",
        featured: 1,
        start: addDays(now, 23, 19),
        end: addDays(now, 24, 2),
        image: img(
          "vibrant african concert crowd hands raised, purple and cyan stage lights, haze, premium event photography, cinematic, night",
        ),
        ageLimit: "18+",
        tiers: [
          {
            id: "tt_neon_ga",
            name: "General Admission",
            description: "Standing access to all three stages.",
            price: 2000,
            capacity: 500,
            perks: "Standing access · All stages",
          },
          {
            id: "tt_neon_vip",
            name: "VIP",
            description: "Elevated VIP deck with dedicated bar.",
            price: 4500,
            capacity: 120,
            perks: "Fast-lane entry · VIP deck · Welcome drink",
          },
          {
            id: "tt_neon_table",
            name: "VVIP Table (6 guests)",
            description: "Reserved table for six with bottle service.",
            price: 35000,
            capacity: 12,
            maxPerOrder: 2,
            perks: "Table for 6 · Bottle service · Dedicated host",
          },
        ],
      },
      {
        id: "evt_rooftop",
        slug: "rooftop-sessions-skyline",
        title: "Rooftop Sessions at Skyline",
        tagline: "Sunset sets, skyline views and deep house on the 12th floor.",
        description:
          "An intimate rooftop session above the Harare skyline. Expect deep house, afro-tech and soulful sets from 18:00 until late, with a limited capacity that keeps the dance floor comfortable.\n\nEarly Bird tickets are strictly limited. General admission includes rooftop access; VIP Lounge adds reserved seating, a dedicated server and a welcome cocktail.\n\nDress code: smart casual. This is an 18+ event.",
        category: "Parties",
        city: "Harare",
        venue: "Skyline Rooftop, 12th Floor",
        address: "Cnr Julius Nyerere Way & Kwame Nkrumah Ave",
        organizer: "usr_org1",
        status: "approved",
        featured: 1,
        start: addDays(now, 9, 18),
        end: addDays(now, 10, 1),
        image: img(
          "rooftop party at sunset in harare, city skyline, string lights, stylish young african crowd, premium lifestyle photography",
        ),
        ageLimit: "18+",
        tiers: [
          {
            id: "tt_roof_early",
            name: "Early Bird",
            description: "Limited release at the lowest price.",
            price: 1000,
            capacity: 100,
            perks: "Rooftop access",
          },
          {
            id: "tt_roof_ga",
            name: "General Admission",
            description: "Rooftop access for the full session.",
            price: 1500,
            capacity: 180,
            perks: "Rooftop access · All sets",
          },
          {
            id: "tt_roof_vip",
            name: "VIP Lounge",
            description: "Reserved seating and dedicated service.",
            price: 4000,
            capacity: 40,
            maxPerOrder: 4,
            perks: "Reserved seating · Dedicated server · Welcome cocktail",
          },
        ],
      },
      {
        id: "evt_zimfest",
        slug: "zim-fest-2026",
        title: "Zim Fest 2026",
        tagline: "Two days. Four stages. The sound of Zimbabwe.",
        description:
          "Zim Fest is the country's flagship outdoor music festival, bringing together amapiano, sungura, gospel, hip-hop and afro-fusion across two days in Bulawayo.\n\nGates open at 12:00 daily. Your ticket covers both days unless marked otherwise. Food and drink vendors, a craft market and a family zone run throughout the festival grounds.\n\nNo glass, no weapons and no external alcohol will be allowed through the gate. Bag searches apply.",
        category: "Festivals",
        city: "Bulawayo",
        venue: "Bulawayo Amphitheatre",
        address: "Hillside Road, Bulawayo",
        organizer: "usr_org1",
        status: "approved",
        featured: 1,
        start: addDays(now, 44, 12),
        end: addDays(now, 45, 23),
        image: img(
          "outdoor african music festival, large crowd, colorful stage, daytime, flags, energetic, premium editorial photography",
        ),
        ageLimit: "All ages · 16+ zones",
        tiers: [
          {
            id: "tt_zim_early",
            name: "Early Bird (2-day)",
            description: "Limited release for both festival days.",
            price: 2500,
            capacity: 400,
            perks: "Both days · General standing",
          },
          {
            id: "tt_zim_ga",
            name: "General Admission (2-day)",
            description: "Access to all public stages for both days.",
            price: 3000,
            capacity: 800,
            perks: "Both days · All public stages",
          },
          {
            id: "tt_zim_vip",
            name: "VIP (2-day)",
            description: "VIP compound with shaded lounge and fast entry.",
            price: 7000,
            capacity: 150,
            maxPerOrder: 4,
            perks: "VIP compound · Fast entry · Shaded lounge",
          },
        ],
      },
      {
        id: "evt_roora",
        slug: "roora-experience-2026",
        title: "The Roora Experience",
        tagline: "A contemporary celebration of Zimbabwean marriage tradition.",
        description:
          "The Roora Experience is a curated cultural evening celebrating the tradition of roora through music, food, fashion and storytelling. Set in the Rainbow Towers ballroom, the evening brings together families, cultural practitioners and live performers.\n\nStandard tickets include the main programme and a welcome drink. Family Tables seat six and include a three-course dinner and reserved front-row seating.\n\nTraditional or smart formal dress is encouraged.",
        category: "Weddings & Roora",
        city: "Harare",
        venue: "Rainbow Towers Ballroom",
        address: "Pennefather Avenue, Harare",
        organizer: "usr_org2",
        status: "approved",
        featured: 0,
        start: addDays(now, 31, 15),
        end: addDays(now, 31, 22),
        image: img(
          "elegant zimbabwean traditional wedding roora ceremony, colorful fabrics, joyful family gathering, warm golden light, editorial photography",
        ),
        ageLimit: "All ages",
        tiers: [
          {
            id: "tt_roora_std",
            name: "Standard",
            description: "Main programme and welcome drink.",
            price: 1500,
            capacity: 300,
            perks: "Main programme · Welcome drink",
          },
          {
            id: "tt_roora_table",
            name: "Family Table (6 guests)",
            description: "Reserved table with a three-course dinner.",
            price: 9000,
            capacity: 40,
            maxPerOrder: 2,
            perks: "Table for 6 · Three-course dinner · Front-row seating",
          },
        ],
      },
      {
        id: "evt_gospel",
        slug: "gospel-explosion-2026",
        title: "Gospel Explosion",
        tagline: "An evening of praise, worship and Zimbabwean gospel favourites.",
        description:
          "Gospel Explosion brings together leading choirs and artists for an evening of worship at the City Sports Centre. The programme begins at 17:00 and runs until 22:00.\n\nFree entry tickets must still be reserved so that we can manage capacity and admission safely. General and VIP tiers support the production and give you reserved seating closer to the stage.\n\nChildren under 12 enter free with a ticketed adult.",
        category: "Church",
        city: "Harare",
        venue: "City Sports Centre",
        address: "Cnr Harare Street & Chinhoyi Street",
        organizer: "usr_org1",
        status: "approved",
        featured: 0,
        start: addDays(now, 51, 17),
        end: addDays(now, 51, 22),
        image: img(
          "large gospel choir on stage in a sports arena, purple stage lighting, uplifting atmosphere, wide shot, professional event photography",
        ),
        ageLimit: "All ages",
        tiers: [
          {
            id: "tt_gospel_free",
            name: "Free Entry",
            description: "Reserved free entry — capacity controlled.",
            price: 0,
            capacity: 1000,
            perks: "General entry",
          },
          {
            id: "tt_gospel_ga",
            name: "General",
            description: "General seated entry.",
            price: 1000,
            capacity: 2000,
            perks: "Seated entry",
          },
          {
            id: "tt_gospel_vip",
            name: "VIP",
            description: "Reserved seating near the stage.",
            price: 3000,
            capacity: 200,
            perks: "Reserved front seating",
          },
        ],
      },
      {
        id: "evt_summit",
        slug: "harare-business-summit",
        title: "Harare Business Summit",
        tagline: "Capital, trade and the next decade of Zimbabwean business.",
        description:
          "A single-day summit for founders, operators and investors building in Zimbabwe. Sessions cover access to capital, regional trade, digital infrastructure and workforce development.\n\nThe Standard pass covers all keynote and panel sessions, networking breaks and the exhibition floor. The Delegate Pass adds a seated lunch, the closed-door roundtables and the evening networking reception.\n\nRegistration opens at 08:00. Sessions begin at 09:00.",
        category: "Conferences",
        city: "Harare",
        venue: "HICC, Zimbali Room",
        address: "Samora Machel Avenue, Harare",
        organizer: "usr_org1",
        status: "approved",
        featured: 0,
        start: addDays(now, 15, 8, 30),
        end: addDays(now, 15, 17),
        image: img(
          "modern business conference in harare, african professionals networking, glass conference centre, bright, premium corporate photography",
        ),
        ageLimit: "18+",
        tiers: [
          {
            id: "tt_summit_std",
            name: "Standard Pass",
            description: "All sessions, networking breaks and exhibition.",
            price: 5000,
            capacity: 300,
            perks: "Keynotes · Panels · Exhibition",
          },
          {
            id: "tt_summit_delegate",
            name: "Delegate Pass",
            description: "Full access including lunch and roundtables.",
            price: 12000,
            capacity: 80,
            perks: "Roundtables · Seated lunch · Evening reception",
          },
        ],
      },
      {
        id: "evt_vicfalls",
        slug: "victoria-falls-sundowner",
        title: "Victoria Falls Sundowner",
        tagline: "Golden hour on the Zambezi with live afro-soul.",
        description:
          "A limited-capacity sundowner on the Zambezi Deck, timed for golden hour and finished under the stars. Live afro-soul trio, curated food stations and a full bar.\n\nSundowner tickets include deck access and a welcome drink. VIP Deck adds reserved loungers, a dedicated bar and canapé service.\n\nTransport is not included. The venue operates a strict no-glass policy on the deck.",
        category: "Parties",
        city: "Victoria Falls",
        venue: "Zambezi Deck",
        address: "River Drive, Victoria Falls",
        organizer: "usr_org2",
        status: "approved",
        featured: 0,
        start: addDays(now, 37, 16, 30),
        end: addDays(now, 37, 21),
        image: img(
          "sundowner party on the zambezi river deck near victoria falls, golden hour, elegant guests, lush scenery, premium travel photography",
        ),
        ageLimit: "18+",
        tiers: [
          {
            id: "tt_falls_std",
            name: "Sundowner",
            description: "Deck access and a welcome drink.",
            price: 3500,
            capacity: 150,
            perks: "Deck access · Welcome drink",
          },
          {
            id: "tt_falls_vip",
            name: "VIP Deck",
            description: "Reserved loungers and canapé service.",
            price: 8500,
            capacity: 50,
            maxPerOrder: 4,
            perks: "Reserved lounger · Dedicated bar · Canapés",
          },
        ],
      },
      {
        id: "evt_campus",
        slug: "campus-fest-2026",
        title: "Campus Fest",
        tagline: "The biggest student party in Bulawayo.",
        description:
          "Campus Fest returns to NUST with a daytime festival of music, sport and food. Open to students and the public, with a dedicated student ticket and a family-friendly daytime programme.\n\nBring your student ID for student-rate entry. Gates close at 20:00 and the last shuttle leaves at 23:00.",
        category: "School",
        city: "Bulawayo",
        venue: "NUST Campus Grounds",
        address: "Cnr Gwanda Road & Cecil Avenue, Bulawayo",
        organizer: "usr_org2",
        status: "approved",
        featured: 0,
        start: addDays(now, 17, 12),
        end: addDays(now, 17, 23),
        image: img(
          "university campus festival, african students celebrating, colorful tents, daytime, energetic, editorial photography",
        ),
        ageLimit: "All ages",
        tiers: [
          {
            id: "tt_campus_student",
            name: "Student",
            description: "Valid student ID required at the gate.",
            price: 500,
            capacity: 500,
            maxPerOrder: 2,
            perks: "Student entry · ID required",
          },
          {
            id: "tt_campus_ga",
            name: "General",
            description: "Open to students and the public.",
            price: 1000,
            capacity: 500,
            perks: "General entry",
          },
        ],
      },
      {
        id: "evt_jazz",
        slug: "harare-jazz-night",
        title: "Harare Jazz Night",
        tagline: "An intimate evening of Zimbabwean jazz.",
        description:
          "A seated jazz evening at the Alliance Française featuring a quintet led by some of Harare's finest session players. This event has taken place.",
        category: "Concerts",
        city: "Harare",
        venue: "Alliance Française",
        address: "Herbert Chitepo Avenue, Harare",
        organizer: "usr_org2",
        status: "completed",
        featured: 0,
        start: addDays(now, -32, 19),
        end: addDays(now, -32, 22),
        image: img(
          "intimate jazz night in harare, saxophone player on stage, warm amber lighting, sophisticated audience, cinematic",
        ),
        ageLimit: "All ages",
        tiers: [
          {
            id: "tt_jazz_ga",
            name: "General",
            description: "Seated general admission.",
            price: 1500,
            capacity: 200,
            perks: "Seated entry",
          },
        ],
      },
      {
        id: "evt_amapiano",
        slug: "amapiano-all-white",
        title: "Amapiano All White",
        tagline: "An all-white amapiano night at the Harare Gardens.",
        description:
          "An all-white dress amapiano night featuring a line-up of Harare and Johannesburg DJs. Currently awaiting administrator review before tickets go live at these prices.\n\nThe organizer has requested an early-bird price change; the pending price is not yet live.",
        category: "Nightlife",
        city: "Harare",
        venue: "Harare Gardens",
        address: "Cnr Rekayi Tangwena Ave, Harare",
        organizer: "usr_org1",
        status: "pending",
        featured: 0,
        start: addDays(now, 40, 20),
        end: addDays(now, 41, 3),
        image: img(
          "amapiano all white party, elegant african crowd in white outfits, purple club lighting, luxury nightlife photography",
        ),
        ageLimit: "18+",
        tiers: [
          {
            id: "tt_ama_early",
            name: "Early Bird",
            description: "Limited early release.",
            price: 2000,
            capacity: 300,
            perks: "General entry",
          },
          {
            id: "tt_ama_ga",
            name: "General Admission",
            description: "Standard entry.",
            price: 2500,
            capacity: 500,
            perks: "General entry",
          },
        ],
      },
      {
        id: "evt_nye",
        slug: "new-years-eve-countdown",
        title: "New Year's Eve Countdown",
        tagline: "Fireworks, live bands and a midnight countdown.",
        description:
          "Draft concept for a city-centre New Year's Eve countdown. Not yet submitted for approval. Dates and venue are provisional.",
        category: "Festivals",
        city: "Harare",
        venue: "Harare City Centre (TBC)",
        address: "Harare CBD",
        organizer: "usr_org1",
        status: "draft",
        featured: 0,
        start: addDays(now, 70, 20),
        end: addDays(now, 71, 2),
        image: img(
          "new years eve celebration, fireworks over harare skyline, champagne, purple and gold lights, premium event photography",
        ),
        ageLimit: "18+",
        tiers: [
          {
            id: "tt_nye_ga",
            name: "General Admission",
            description: "Standing entry.",
            price: 3000,
            capacity: 400,
            perks: "General entry",
          },
          {
            id: "tt_nye_vip",
            name: "VIP",
            description: "Elevated viewing deck.",
            price: 10000,
            capacity: 80,
            perks: "Viewing deck · Welcome drink",
          },
        ],
      },
    ];

    for (const event of events) {
      const capacity = event.tiers.reduce((sum, t) => sum + t.capacity, 0);
      insert(db, "events", {
        id: event.id,
        slug: event.slug,
        title: event.title,
        tagline: event.tagline,
        description: event.description,
        category: event.category,
        city: event.city,
        venue: event.venue,
        address: event.address,
        starts_at: event.start,
        ends_at: event.end,
        cover_image: event.image,
        organizer_id: event.organizer,
        status: event.status,
        featured: event.featured,
        age_limit: event.ageLimit || null,
        terms:
          "Tickets are non-transferable unless EventIQ support approves a transfer. Entry may be refused without a valid ticket or ID where an age limit applies. Refunds follow the EventIQ refund policy.",
        capacity,
        created_at: addDays(now, -70, 9),
        submitted_at:
          event.status === "draft" ? null : addDays(now, -50, 9),
        approved_by:
          event.status === "approved" || event.status === "completed"
            ? "usr_admin"
            : null,
        approved_at:
          event.status === "approved" || event.status === "completed"
            ? addDays(now, -45, 12)
            : null,
        rejection_reason: null,
        scheme_json: null,
      });

      event.tiers.forEach((tier, index) => {
        insert(db, "ticket_types", {
          id: tier.id,
          event_id: event.id,
          name: tier.name,
          description: tier.description,
          price_cents: tier.price,
          capacity: tier.capacity,
          sold: 0,
          sales_start: addDays(now, -55, 9),
          sales_end: event.start,
          max_per_order: tier.maxPerOrder ?? 6,
          perks: tier.perks ?? null,
          sort_order: index,
        });
      });
    }

    const approvedEventSeeds = events.filter((e) => e.status === "approved");
    const guests = users.filter((u) => u.role === "attendee" && u.id !== "usr_attendee");
    const random = makeRandom(20261022);
    const soldByTier = new Map<string, number>();
    const usedCodes = new Set<string>();
    let orderCounter = 0;
    const scanLogs: Array<Record<string, SQLValue>> = [];

    function nextCode() {
      let code = ticketCode();
      while (usedCodes.has(code)) code = ticketCode();
      usedCodes.add(code);
      return code;
    }

    function createOrder(opts: {
      user: { id: string; name: string };
      event: EventSeed;
      tier: TierSeed;
      quantity: number;
      status: string;
      createdAt: string;
    }) {
      const { user, event, tier, quantity, status, createdAt } = opts;
      if (tier.price === 0 && status !== "paid") return null;
      orderCounter += 1;
      const subtotal = tier.price * quantity;
      const fee = Math.round(subtotal * 0.05);
      const commission = Math.round(subtotal * 0.08);
      const total = subtotal + fee;
      const orderId = `ord_seed_${orderCounter}`;
      const paid = status === "paid" || status === "refunded";
      const methods = ["ecocash", "card", "bank"];
      insert(db, "orders", {
        id: orderId,
        reference: `ORD-S${String(orderCounter).padStart(4, "0")}${String.fromCharCode(
          65 + (orderCounter % 26),
        )}`,
        user_id: user.id,
        event_id: event.id,
        status,
        subtotal_cents: subtotal,
        fee_cents: fee,
        total_cents: total,
        commission_cents: commission,
        refunded_cents: status === "refunded" ? total : 0,
        currency: "USD",
        payment_method: paid ? methods[orderCounter % methods.length] : null,
        payment_ref: paid ? `PAY-${orderId.slice(-6).toUpperCase()}` : null,
        provider: paid ? "simulated" : null,
        idempotency_key: `seed-idem-${orderCounter}`,
        expires_at:
          status === "pending" ? addMinutes(new Date().toISOString(), 25) : addMinutes(createdAt, 20),
        created_at: createdAt,
        paid_at: paid ? addMinutes(createdAt, 3) : null,
      });
      insert(db, "order_items", {
        id: `oi_seed_${orderCounter}`,
        order_id: orderId,
        ticket_type_id: tier.id,
        quantity,
        unit_price_cents: tier.price,
      });

      if (status === "pending" || status === "paid") {
        soldByTier.set(tier.id, (soldByTier.get(tier.id) || 0) + quantity);
      }

      if (paid) {
        const isCompleted = event.status === "completed";
        for (let i = 0; i < quantity; i += 1) {
          const ticketId = `tkt_seed_${orderCounter}_${i}`;
          const code = nextCode();
          const usedAt = isCompleted ? addHours(event.start, 1) : null;
          insert(db, "tickets", {
            id: ticketId,
            code,
            order_id: orderId,
            ticket_type_id: tier.id,
            event_id: event.id,
            holder_name: user.name,
            status: status === "refunded" ? "void" : isCompleted ? "used" : "valid",
            issued_at: addMinutes(createdAt, 3),
            used_at: usedAt,
            used_gate: usedAt ? "Main gate" : null,
            used_by: usedAt ? "usr_gate" : null,
          });
          if (usedAt) {
            scanLogs.push({
              id: `scan_seed_${ticketId}`,
              ticket_id: ticketId,
              ticket_code: code,
              event_id: event.id,
              result: "accepted",
              message: "Valid ticket — admitted",
              gate: "Main gate",
              scanned_by: "usr_gate",
              scanner_name: "Blessing Sibanda",
              device_id: "dev_scanner_a",
              created_at: usedAt,
            });
          }
        }
      }
      return orderId;
    }

    const statuses = [
      "paid",
      "paid",
      "paid",
      "paid",
      "paid",
      "paid",
      "paid",
      "paid",
      "paid",
      "refunded",
      "failed",
      "pending",
    ];

    for (const event of approvedEventSeeds) {
      const volume =
        event.id === "evt_zimfest"
          ? 30
          : event.id === "evt_neon"
            ? 24
            : event.id === "evt_rooftop"
              ? 18
              : 14;
      for (let i = 0; i < volume; i += 1) {
        const user = guests[Math.floor(random() * guests.length)];
        const tier = event.tiers[Math.floor(random() * event.tiers.length)];
        const quantity = 1 + Math.floor(random() * 3);
        const sold = soldByTier.get(tier.id) || 0;
        if (sold + quantity > tier.capacity * 0.72) continue;
        const status = statuses[Math.floor(random() * statuses.length)];
        const daysAgo = 1 + Math.floor(random() * 38);
        const createdAt = addDays(now, -daysAgo, 10 + Math.floor(random() * 8), 15);
        createOrder({ user, event, tier, quantity, status, createdAt });
      }
    }

    // Demo attendee orders — stable, predictable tickets for walkthroughs.
    const neonEvent = events.find((e) => e.id === "evt_neon")!;
    const roofEvent = events.find((e) => e.id === "evt_rooftop")!;
    const jazzEvent = events.find((e) => e.id === "evt_jazz")!;
    const demoUser = { id: "usr_attendee", name: "Tino Moyo" };

    createOrder({
      user: demoUser,
      event: neonEvent,
      tier: neonEvent.tiers[0],
      quantity: 1,
      status: "paid",
      createdAt: addDays(now, -6, 11, 20),
    });
    createOrder({
      user: demoUser,
      event: neonEvent,
      tier: neonEvent.tiers[1],
      quantity: 1,
      status: "paid",
      createdAt: addDays(now, -6, 11, 22),
    });
    createOrder({
      user: demoUser,
      event: roofEvent,
      tier: roofEvent.tiers[1],
      quantity: 2,
      status: "paid",
      createdAt: addDays(now, -3, 16, 10),
    });
    createOrder({
      user: demoUser,
      event: jazzEvent,
      tier: jazzEvent.tiers[0],
      quantity: 1,
      status: "paid",
      createdAt: addDays(now, -34, 12, 0),
    });

    // Demo attendee personalization — favorites, interests and recently viewed.
    const favoriteSeed = [
      { eventId: "evt_fridaylive", daysAgo: 2 },
      { eventId: "evt_amapiano", daysAgo: 5 },
      { eventId: "evt_vicfalls", daysAgo: 9 },
    ];
    for (const item of favoriteSeed) {
      db.prepare(
        "INSERT OR IGNORE INTO favorite_events (user_id, event_id, created_at) VALUES (?, ?, ?)",
      ).run(demoUser.id, item.eventId, addDays(now, -item.daysAgo, 9, 30));
    }
    const interestSeed = ["Concerts", "Nightlife", "Comedy"];
    interestSeed.forEach((category, index) => {
      db.prepare(
        "INSERT OR IGNORE INTO user_interests (user_id, category, created_at) VALUES (?, ?, ?)",
      ).run(demoUser.id, category, addDays(now, -12, 10, 5 + index));
    });
    const viewedSeed = [
      { eventId: "evt_fridaylive", daysAgo: 1 },
      { eventId: "evt_zimfest", daysAgo: 2 },
      { eventId: "evt_amapiano", daysAgo: 3 },
      { eventId: "evt_nye", daysAgo: 6 },
    ];
    for (const item of viewedSeed) {
      db.prepare(
        `INSERT OR IGNORE INTO recently_viewed_events (user_id, event_id, viewed_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, event_id) DO UPDATE SET viewed_at = excluded.viewed_at`,
      ).run(demoUser.id, item.eventId, addDays(now, -item.daysAgo, 20, 45));
    }

    // Sync sold counters with the orders actually created.
    for (const [tierId, sold] of soldByTier) {
      db.prepare("UPDATE ticket_types SET sold = ? WHERE id = ?").run(sold, tierId);
    }

    // A duplicate and an invalid scan for the gate dashboard demo.
    const usedTicket = db
      .prepare(
        "SELECT id, code FROM tickets WHERE event_id = ? AND status = 'used' LIMIT 1",
      )
      .get("evt_jazz") as { id: string; code: string } | undefined;
    if (usedTicket) {
      scanLogs.push({
        id: "scan_seed_duplicate",
        ticket_id: usedTicket.id,
        ticket_code: usedTicket.code,
        event_id: "evt_jazz",
        result: "duplicate",
        message: "Ticket already scanned — admission denied",
        gate: "Main gate",
        scanned_by: "usr_gate",
        scanner_name: "Blessing Sibanda",
        device_id: "dev_scanner_b",
        created_at: addMinutes(new Date().toISOString(), -4),
      });
    }
    scanLogs.push({
      id: "scan_seed_invalid",
      ticket_id: null,
      ticket_code: "EVQ-ABCD-EFGH-JKLM",
      event_id: "evt_jazz",
      result: "invalid",
      message: "Ticket not found",
      gate: "Main gate",
      scanned_by: "usr_gate",
      scanner_name: "Blessing Sibanda",
      device_id: "dev_scanner_b",
      created_at: addMinutes(new Date().toISOString(), -2),
    });

    for (const log of scanLogs) {
      insert(db, "scan_events", log as Record<string, SQLValue>);
    }

    insert(db, "price_requests", {
      id: "pr_seed_1",
      event_id: "evt_zimfest",
      ticket_type_id: "tt_zim_early",
      old_price_cents: 2500,
      new_price_cents: 3500,
      requested_by: "usr_org1",
      status: "pending",
      note: "Supplier costs increased. Requesting an early-bird price adjustment to $35.",
      reviewed_by: null,
      reviewed_at: null,
      created_at: addDays(now, -2, 14),
    });
    insert(db, "price_requests", {
      id: "pr_seed_2",
      event_id: "evt_neon",
      ticket_type_id: "tt_neon_vip",
      old_price_cents: 4000,
      new_price_cents: 4500,
      requested_by: "usr_org1",
      status: "approved",
      note: "VIP production costs confirmed.",
      reviewed_by: "usr_ceo",
      reviewed_at: addDays(now, -20, 10),
      created_at: addDays(now, -21, 9),
    });

    const staffAssignments = [
      { id: "staff_1", event_id: "evt_neon", user_id: "usr_gate", gate_name: "Gate A" },
      { id: "staff_2", event_id: "evt_jazz", user_id: "usr_gate", gate_name: "Main gate" },
      { id: "staff_3", event_id: "evt_zimfest", user_id: "usr_gate", gate_name: "Gate B" },
    ];
    for (const s of staffAssignments) {
      insert(db, "event_staff", {
        ...s,
        created_at: addDays(now, -10, 9),
      });
    }

    const gates = [
      {
        id: "gate_neon_a",
        event_id: "evt_neon",
        name: "Gate A",
        kind: "turnstile",
        direction: "in",
        status: "active",
        open_ms: 600,
      },
      {
        id: "gate_neon_vip",
        event_id: "evt_neon",
        name: "VIP lane",
        kind: "overhead",
        direction: "in",
        status: "active",
        open_ms: 800,
      },
      {
        id: "gate_jazz_main",
        event_id: "evt_jazz",
        name: "Main gate",
        kind: "turnstile",
        direction: "in",
        status: "active",
        open_ms: 600,
      },
    ];
    for (const gate of gates) {
      insert(db, "gates", {
        ...gate,
        created_at: addDays(now, -40, 9),
        updated_at: addDays(now, -2, 9),
      });
    }

    const devices = [
      {
        id: "dev_scanner_a",
        name: "Gate A Scanner 01",
        serial: "SCN-2026-0192",
        type: "scanner",
        status: "active",
        assigned_event_id: "evt_neon",
        assigned_staff_id: "usr_gate",
        gate_id: "gate_neon_a",
        assigned_at: addDays(now, -5, 9),
      },
      {
        id: "dev_scanner_b",
        name: "Gate B Scanner 02",
        serial: "SCN-2026-0193",
        type: "scanner",
        status: "active",
        assigned_event_id: "evt_jazz",
        assigned_staff_id: "usr_gate",
        gate_id: "gate_jazz_main",
        assigned_at: addDays(now, -30, 9),
      },
      {
        id: "dev_neon_ctrl",
        name: "Gate A Turnstile Controller",
        serial: "CTL-2026-0101",
        type: "gate_controller",
        status: "active",
        assigned_event_id: "evt_neon",
        assigned_staff_id: null,
        gate_id: "gate_neon_a",
        assigned_at: addDays(now, -5, 9),
      },
      {
        id: "dev_printer_1",
        name: "Ticket Printer 01",
        serial: "PRN-2026-0041",
        type: "printer",
        status: "active",
        assigned_event_id: null,
        assigned_staff_id: null,
        gate_id: null,
        assigned_at: null,
      },
      {
        id: "dev_encoder_1",
        name: "RFID Encoder (pilot)",
        serial: "ENC-2026-0007",
        type: "encoder",
        status: "maintenance",
        assigned_event_id: null,
        assigned_staff_id: null,
        gate_id: null,
        assigned_at: null,
      },
    ];
    for (const d of devices) {
      insert(db, "devices", {
        ...d,
        updated_at: addDays(now, -2, 9),
      });
    }

    const bookings = [
      {
        id: "bkg_zimfest_tafara",
        artist_id: "usr_artist1",
        organizer_id: "usr_org1",
        event_id: "evt_zimfest",
        status: "accepted",
        proposed_fee_cents: 120000,
        message:
          "We would love TAFARA to headline the main stage on day two. Full band, 60-minute set, soundcheck at 15:00.",
        response_note: null,
        created_at: addDays(now, -12, 10),
        responded_at: addDays(now, -11, 16),
      },
      {
        id: "bkg_roora_tafara",
        artist_id: "usr_artist1",
        organizer_id: "usr_org2",
        event_id: "evt_roora",
        status: "requested",
        proposed_fee_cents: 85000,
        message:
          "An acoustic set during the dinner service would suit the evening perfectly. Two 25-minute sets with a short break.",
        response_note: null,
        created_at: addDays(now, -2, 9),
        responded_at: null,
      },
      {
        id: "bkg_gospel_tafara",
        artist_id: "usr_artist1",
        organizer_id: "usr_org1",
        event_id: "evt_gospel",
        status: "requested",
        proposed_fee_cents: null,
        message:
          "Would you be open to closing the evening with two worship songs? We can discuss the fee once the running order is confirmed.",
        response_note: null,
        created_at: addDays(now, -1, 14),
        responded_at: null,
      },
      {
        id: "bkg_rooftop_tafara",
        artist_id: "usr_artist1",
        organizer_id: "usr_org1",
        event_id: "evt_rooftop",
        status: "declined",
        proposed_fee_cents: 40000,
        message: "A 45-minute sunset set on the rooftop.",
        response_note: "Already committed to a private function that evening — happy to discuss the next session.",
        created_at: addDays(now, -8, 11),
        responded_at: addDays(now, -7, 8),
      },
      {
        id: "bkg_neon_kudzai",
        artist_id: "usr_artist2",
        organizer_id: "usr_org1",
        event_id: "evt_neon",
        status: "requested",
        proposed_fee_cents: 60000,
        message:
          "We are holding a 30-minute amapiano slot on the second stage between 23:00 and midnight.",
        response_note: null,
        created_at: addDays(now, -1, 18),
        responded_at: null,
      },
    ];

    for (const booking of bookings) {
      insert(db, "artist_bookings", {
        ...booking,
        currency: "USD",
      });
    }

    const availabilityBlocks = [
      {
        id: "avl_studio_tafara",
        artist_id: "usr_artist1",
        starts_at: addDays(now, 4, 9),
        ends_at: addDays(now, 6, 22),
        note: "Studio rehearsals — private",
        created_at: addDays(now, -3, 9),
      },
      {
        id: "avl_tour_kudzai",
        artist_id: "usr_artist2",
        starts_at: addDays(now, 12, 8),
        ends_at: addDays(now, 16, 20),
        note: "Regional tour — Bulawayo and Gweru",
        created_at: addDays(now, -5, 12),
      },
    ];

    for (const block of availabilityBlocks) {
      insert(db, "artist_availability", block);
    }

    insert(db, "artist_agreements", {
      id: "agr_zimfest_tafara",
      booking_id: "bkg_zimfest_tafara",
      artist_id: "usr_artist1",
      organizer_id: "usr_org1",
      status: "accepted",
      current_version: 2,
      created_at: addDays(now, -11, 12),
      updated_at: addDays(now, -6, 15),
    });

    const agreementVersions = [
      {
        id: "agv_zimfest_tafara_v1",
        agreement_id: "agr_zimfest_tafara",
        version: 1,
        status: "superseded",
        fee_cents: 100000,
        currency: "USD",
        deposit_cents: 40000,
        deposit_due_on: dayKey(now, -9),
        balance_due_on: dayKey(now, 20),
        cancellation_terms:
          "Either party may cancel with 21 days' written notice. The deposit is non-refundable after that point.",
        transport_arrangements: "Ground transport from Harare to Bulawayo and back for the full band.",
        accommodation_arrangements: "Two nights for six people at the festival partner hotel.",
        technical_requirements:
          "Full backline, 12-channel monitor mix and a 60-minute soundcheck on the day.",
        responsibilities:
          "Organizer provides stage, sound crew and security. Artist provides instruments and set list.",
        additional_conditions: null,
        change_summary: null,
        response_note: null,
        created_by: "usr_org1",
        created_at: addDays(now, -11, 12),
        sent_at: addDays(now, -11, 14),
        responded_at: addDays(now, -10, 9),
      },
      {
        id: "agv_zimfest_tafara_v2",
        agreement_id: "agr_zimfest_tafara",
        version: 2,
        status: "accepted",
        fee_cents: 120000,
        currency: "USD",
        deposit_cents: 40000,
        deposit_due_on: dayKey(now, -9),
        balance_due_on: dayKey(now, 20),
        cancellation_terms:
          "Either party may cancel with 21 days' written notice. The deposit is non-refundable after that point.",
        transport_arrangements: "Ground transport from Harare to Bulawayo and back for the full band.",
        accommodation_arrangements: "Two nights for six people at the festival partner hotel.",
        technical_requirements:
          "Full backline, 12-channel monitor mix and a 60-minute soundcheck on the day.",
        responsibilities:
          "Organizer provides stage, sound crew and security. Artist provides instruments and set list.",
        additional_conditions: "Artist closes day two with a 60-minute headline set.",
        change_summary:
          "Extended the set to 60 minutes as the day-two headline and increased the fee from $1,000 to $1,200.",
        response_note: null,
        created_by: "usr_org1",
        created_at: addDays(now, -7, 10),
        sent_at: addDays(now, -7, 11),
        responded_at: addDays(now, -6, 15),
      },
    ];

    for (const version of agreementVersions) {
      insert(db, "artist_agreement_versions", version);
    }

    insert(db, "artist_invoices", {
      id: "inv_zimfest_tafara_balance",
      agreement_id: "agr_zimfest_tafara",
      artist_id: "usr_artist1",
      organizer_id: "usr_org1",
      number: "INV-2026-0001",
      description: "Zim Fest 2026 — balance of the agreed performance fee",
      amount_cents: 80000,
      currency: "USD",
      status: "issued",
      issued_on: dayKey(now, -5),
      due_on: dayKey(now, 20),
      created_by: "usr_artist1",
      created_at: addDays(now, -5, 12),
    });

    const payments = [
      {
        id: "pay_zimfest_tafara_deposit",
        agreement_id: "agr_zimfest_tafara",
        invoice_id: null,
        artist_id: "usr_artist1",
        organizer_id: "usr_org1",
        amount_cents: 40000,
        currency: "USD",
        status: "received",
        method: "bank_transfer",
        reference: "ZBF-84211",
        note: "Deposit for the Zim Fest headline set.",
        paid_on: dayKey(now, -9),
        recorded_by: "usr_org1",
        recorded_at: addDays(now, -9, 10),
        confirmed_by: "usr_artist1",
        confirmed_at: addDays(now, -9, 11),
        created_at: addDays(now, -9, 10),
      },
      {
        id: "pay_zimfest_tafara_balance_part",
        agreement_id: "agr_zimfest_tafara",
        invoice_id: "inv_zimfest_tafara_balance",
        artist_id: "usr_artist1",
        organizer_id: "usr_org1",
        amount_cents: 20000,
        currency: "USD",
        status: "recorded",
        method: "mobile_money",
        reference: "EC-7741",
        note: "Part payment towards the balance.",
        paid_on: dayKey(now, -2),
        recorded_by: "usr_org1",
        recorded_at: addDays(now, -2, 9),
        confirmed_by: null,
        confirmed_at: null,
        created_at: addDays(now, -2, 9),
      },
    ];

    for (const payment of payments) {
      insert(db, "artist_payments", payment);
    }

    const auditLogs = [
      {
        actor_id: "usr_ceo",
        actor_name: "Praise Mhaka",
        actor_role: "ceo",
        action: "organizer.approved",
        entity_type: "organizer",
        entity_id: "usr_org1",
        outcome: "success",
        before_json: JSON.stringify({ status: "pending" }),
        after_json: JSON.stringify({ status: "approved" }),
        created_at: addDays(now, -60, 11),
      },
      {
        actor_id: "usr_admin",
        actor_name: "Nyasha Chari",
        actor_role: "admin",
        action: "event.approved",
        entity_type: "event",
        entity_id: "evt_neon",
        outcome: "success",
        before_json: JSON.stringify({ status: "pending" }),
        after_json: JSON.stringify({ status: "approved" }),
        created_at: addDays(now, -45, 12),
      },
      {
        actor_id: "usr_org1",
        actor_name: "Tarisai Chikafu",
        actor_role: "organizer",
        action: "price_change.requested",
        entity_type: "ticket_type",
        entity_id: "tt_zim_early",
        outcome: "success",
        before_json: JSON.stringify({ price_cents: 2500 }),
        after_json: JSON.stringify({ requested_price_cents: 3500 }),
        created_at: addDays(now, -2, 14),
      },
      {
        actor_id: "usr_admin",
        actor_name: "Nyasha Chari",
        actor_role: "admin",
        action: "device.assigned",
        entity_type: "device",
        entity_id: "dev_scanner_a",
        outcome: "success",
        before_json: JSON.stringify({ assigned_event_id: null }),
        after_json: JSON.stringify({ assigned_event_id: "evt_neon" }),
        created_at: addDays(now, -5, 9),
      },
      {
        actor_id: "usr_ceo",
        actor_name: "Praise Mhaka",
        actor_role: "ceo",
        action: "price_change.approved",
        entity_type: "ticket_type",
        entity_id: "tt_neon_vip",
        outcome: "success",
        before_json: JSON.stringify({ price_cents: 4000 }),
        after_json: JSON.stringify({ price_cents: 4500 }),
        created_at: addDays(now, -20, 10),
      },
    ];
    for (const log of auditLogs) {
      insert(db, "audit_logs", {
        ...log,
        ip: "127.0.0.1",
      });
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
