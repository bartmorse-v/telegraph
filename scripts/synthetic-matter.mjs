/**
 * The invented matter, and the answer key that comes with it.
 *
 * Everything a document says about a person, a place, a date, a number or a
 * dollar figure comes from here, so the same list can be handed to the scorer
 * afterwards. That is the whole point of a synthetic file: with a real matter
 * you can only ask a model whether redaction looked thorough, and it will
 * answer confidently either way. Here the question is arithmetic — these
 * ninety-odd strings went in, how many came out?
 *
 * The names are deliberately unusual. A plaintiff called "John Smith" would
 * match half the English language and the score would mean nothing.
 */

export const D = {
  /* people */
  plaintiff: "Marcus DeWitt Hollandsworth",
  plaintiffShort: "Hollandsworth",
  spouse: "Adaeze Hollandsworth",
  defendant: "Renata Kowalczyk-Bell",
  defendantShort: "Kowalczyk-Bell",
  witnessBus: "Oluwaseun Adebayo-Fitch",
  witnessPassenger: "Corwin Petraglia",
  officer: "Delphine Nakagawa",
  treating: "Priyanka Raghunathan",
  surgeon: "Emeka Oyelaran",
  imeDoctor: "Curtis Vandenboom",
  chiropractor: "Lorna Skjelstad",
  adjuster: "Hollis Trembath",
  plaintiffCounsel: "Theodora Marchetti-Ruiz",
  defenseCounsel: "Gerald P. Stankiewicz",
  judge: "Beatrice A. Fennimore",

  /* organizations */
  employer: "Verhoeven Produce Distributors, Inc.",
  employerShort: "Verhoeven",
  plaintiffBusiness: "Hollandsworth Cabinetry and Millwork, LLC",
  plaintiffBusinessAcronym: "HCM",
  liabilityInsurer: "Bergstrom Mutual Casualty Company",
  liabilityInsurerShort: "Bergstrom Mutual",
  uimInsurer: "Sheboygan Falls Reciprocal Insurance Exchange",
  uimInsurerShort: "Sheboygan Falls Reciprocal",
  healthPlan: "Ridgeline Health Plan of Wisconsin",
  healthPlanShort: "Ridgeline",
  clinic: "Quarrington Orthopedic Associates",
  hospital: "St. Ambrose Regional Medical Center",
  therapy: "Kettle Moraine Physical Therapy",
  imaging: "Waubeka Diagnostic Imaging",
  plaintiffFirm: "Marchetti-Ruiz and Boateng, S.C.",
  defenseFirm: "Stankiewicz, Halvorsen and Duplantier LLP",

  /* places — county and state stay, everything finer does not.
     The city is deliberately not the county's namesake: with both called
     "Milwaukee" no redaction could ever pass, because keeping "Milwaukee
     County" necessarily keeps the string the city test is looking for. The
     scorer found that on its first run against a corpus that was otherwise
     perfect. */
  county: "Milwaukee",
  state: "Wisconsin",
  city: "Cudahy",
  defenseCity: "Wauwatosa",
  zip: "53110",
  neighborhood: "the Vermeer Heights neighborhood",
  street: "North Kinnickinnic Avenue",
  crossStreet: "East Rusk Boulevard",
  plaintiffAddress: "4417 North Kinnickinnic Avenue",
  defendantAddress: "812 South Blessingame Court",
  firmAddress: "230 West Wisconsin Avenue, Suite 1900",
  clinicAddress: "6620 West Bluemound Road",

  /* dates */
  crashDate: "June 12, 2022",
  crashTime: "4:42 p.m.",
  dob: "March 14, 1978",
  surgeryDate: "February 3, 2023",
  imeDate: "September 19, 2023",
  filingDate: "November 8, 2022",
  answerDate: "December 21, 2022",
  demandDate: "October 30, 2023",
  settlementDate: "April 16, 2024",
  gapStart: "August 22, 2022",
  gapEnd: "November 14, 2022",

  /* numbers */
  docket: "2022CV004417",
  claimNumber: "BMC-4417-88213",
  policyNumber: "WI-PA-77304412",
  uimPolicyNumber: "SFR-2210-559041",
  barNumber: "1088342",
  ssn: "900-88-6210",
  phonePlaintiffFirm: "(414) 555-0142",
  phoneDefenseFirm: "(414) 555-0188",
  phoneAdjuster: "(920) 555-0176",
  emailPlaintiffCounsel: "tmarchetti@marchettiruizboateng.com",
  emailDefenseCounsel: "gstankiewicz@shdlaw-wi.com",
  mrn: "QOA-5540912",

  /* money */
  policyLimits: "$250,000",
  uimLimits: "$500,000",
  medicalSpecials: "$147,318.44",
  hospitalBill: "$61,904.10",
  surgeryBill: "$48,225.00",
  therapyBill: "$14,880.00",
  imagingBill: "$9,412.34",
  wageLoss: "$38,750.00",
  futureCare: "$92,000",
  demandAmount: "$725,000",
  offerAmount: "$140,000",
  settlementAmount: "$312,500",
  lienAsserted: "$97,441.18",
  lienResolved: "$41,300.00",
  netToClient: "$126,782.55",
};

/**
 * Every planted string, with what it is and how badly it would matter.
 *
 * "high" is a name, a number that identifies a file, or a contact detail —
 * anything whose survival means the redaction did not happen. "medium" is a
 * date or an address. "low" is a dollar figure: recoverable from context in a
 * way a name is not, but still nothing that belongs in a published article.
 */
export function answerKey() {
  const person = (v) => ({ value: v, category: "person_name", severity: "high" });
  const org = (v) => ({ value: v, category: "organization_name", severity: "high" });
  const place = (v) => ({ value: v, category: "location", severity: "medium" });
  const when = (v) => ({ value: v, category: "date", severity: "medium" });
  const num = (v) => ({ value: v, category: "case_or_account_number", severity: "high" });
  const contact = (v) => ({ value: v, category: "contact_detail", severity: "high" });
  const money = (v) => ({ value: v, category: "monetary_amount", severity: "low" });

  return [
    person(D.plaintiff),
    // The short form is the whole reason this file exists. Every document
    // introduces the parties as Full Name ("Surname") and then uses the
    // surname, which is how a real pleading is written and how a redaction
    // pass quietly leaves a name on every page.
    person(D.plaintiffShort),
    person(D.spouse),
    person(D.defendant),
    person(D.defendantShort),
    person(D.witnessBus),
    person(D.witnessPassenger),
    person(D.officer),
    person(D.treating),
    person(D.surgeon),
    person(D.imeDoctor),
    person(D.chiropractor),
    person(D.adjuster),
    person(D.plaintiffCounsel),
    person(D.defenseCounsel),
    person(D.judge),

    org(D.employer),
    org(D.employerShort),
    org(D.plaintiffBusiness),
    // An acronym built from a real name is an identifier too.
    org(D.plaintiffBusinessAcronym),
    org(D.liabilityInsurer),
    org(D.liabilityInsurerShort),
    org(D.uimInsurer),
    org(D.uimInsurerShort),
    org(D.healthPlan),
    org(D.healthPlanShort),
    org(D.clinic),
    org(D.hospital),
    org(D.therapy),
    org(D.imaging),
    org(D.plaintiffFirm),
    org(D.defenseFirm),

    place(D.city),
    place(D.defenseCity),
    place(D.zip),
    place(D.neighborhood),
    place(D.street),
    place(D.crossStreet),
    place(D.plaintiffAddress),
    place(D.defendantAddress),
    place(D.firmAddress),
    place(D.clinicAddress),

    when(D.crashDate),
    when(D.crashTime),
    when(D.dob),
    when(D.surgeryDate),
    when(D.imeDate),
    when(D.filingDate),
    when(D.answerDate),
    when(D.demandDate),
    when(D.settlementDate),
    when(D.gapStart),
    when(D.gapEnd),

    num(D.docket),
    num(D.claimNumber),
    num(D.policyNumber),
    num(D.uimPolicyNumber),
    num(D.ssn),
    num(D.mrn),
    num(D.barNumber),

    contact(D.phonePlaintiffFirm),
    contact(D.phoneDefenseFirm),
    contact(D.phoneAdjuster),
    contact(D.emailPlaintiffCounsel),
    contact(D.emailDefenseCounsel),

    money(D.medicalSpecials),
    money(D.hospitalBill),
    money(D.surgeryBill),
    money(D.therapyBill),
    money(D.imagingBill),
    money(D.wageLoss),
    money(D.futureCare),
    money(D.demandAmount),
    money(D.offerAmount),
    money(D.settlementAmount),
    money(D.lienAsserted),
    money(D.lienResolved),
    money(D.netToClient),
    money(D.policyLimits),
    money(D.uimLimits),
  ];
}

/**
 * What should still be there afterwards.
 *
 * A redaction that removes everything is not a success — it destroys the thing
 * articles are written from. These are the load-bearing legal facts, and the
 * scorer reports them separately: identifiers gone AND these retained is the
 * only outcome that counts.
 */
export const RETAIN = [
  "Milwaukee County",
  "895.045",
  "893.54",
  "347.48",
  "made-whole",
  "comparative negligence",
  "subrogation",
  "underinsured motorist",
  "independent medical examination",
  "degenerative",
];
