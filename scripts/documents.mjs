import { D } from "./synthetic-matter.mjs";

/**
 * The documents themselves.
 *
 * Written the way the real thing is written, because that is what makes the
 * test worth running. Every party is introduced as Full Name ("Surname") and
 * then referred to by the surname — that convention is why the first real
 * matter came back with a name on nearly every page. Bates stamps sit in the
 * footers. Contact details sit in the signature blocks. A treatment gap and a
 * degenerative-changes argument are in here because they are what an article
 * about this kind of case would actually be about.
 *
 * The law is illustrative. Statute numbers are real ones and the arguments are
 * the shape of arguments that get made, but nothing here has been checked the
 * way a filing would be, and no article drawn from this file should ever be
 * published.
 */

const blocks = (...b) => b.flat().filter(Boolean);
const p = (text) => ({ type: "p", text });
const h = (text) => ({ type: "h", text });
const center = (text) => ({ type: "center", text });
const gap = () => ({ type: "gap" });
const rule = () => ({ type: "rule" });

/** Numbered pleading paragraphs, which is most of what a complaint is. */
function numbered(start, items) {
  return items.map((text, i) => ({ type: "num", n: start + i, text }));
}

const caption = (title) =>
  blocks(
    center("STATE OF WISCONSIN"),
    center(`CIRCUIT COURT${"        "}${D.county.toUpperCase()} COUNTY`),
    center("CIVIL DIVISION"),
    gap(),
    p(`${D.plaintiff.toUpperCase()},`),
    p(`${D.plaintiffAddress}`),
    p(`${D.city}, WI ${D.zip},`),
    gap(),
    p("                              Plaintiff,"),
    gap(),
    p(`v.${"                                        "}Case No. ${D.docket}`),
    p(`${"                                              "}Case Code 30101 (Auto Negligence)`),
    gap(),
    p(`${D.defendant.toUpperCase()},`),
    p(`${D.defendantAddress}`),
    p(`${D.city}, WI ${D.zip},`),
    gap(),
    p(`${D.employer.toUpperCase()},`),
    gap(),
    p(`${D.liabilityInsurer.toUpperCase()},`),
    gap(),
    p(`and ${D.uimInsurer.toUpperCase()},`),
    gap(),
    p("                              Defendants."),
    rule(),
    gap(),
    center(title),
    gap(),
  );

export const complaint = () => ({
  file: "01-summons-and-complaint.pdf",
  bates: "HOLLAND",
  batesStart: 1,
  body: blocks(
    caption("COMPLAINT"),
    p(
      `NOW COMES the plaintiff, ${D.plaintiff} ("${D.plaintiffShort}"), by his attorneys, ${D.plaintiffFirm}, and as and for a claim against the defendants alleges as follows:`,
    ),
    gap(),
    h("PARTIES"),
    ...numbered(1, [
      `${D.plaintiffShort} is an adult resident of ${D.county} County, ${D.state}, born ${D.dob}, residing at ${D.plaintiffAddress}, ${D.city}, Wisconsin. ${D.plaintiffShort} is the sole member of ${D.plaintiffBusiness} ("${D.plaintiffBusinessAcronym}"), a cabinetry shop he has operated since 2009.`,
      `Defendant ${D.defendant} ("${D.defendantShort}") is an adult resident of ${D.county} County, ${D.state}, residing at ${D.defendantAddress}, ${D.city}, Wisconsin.`,
      `Defendant ${D.employer} ("${D.employerShort}") is a domestic corporation with its principal place of business in ${D.county} County, ${D.state}. At all material times ${D.defendantShort} was operating a vehicle owned by ${D.employerShort} within the scope of her employment.`,
      `Defendant ${D.liabilityInsurer} ("${D.liabilityInsurerShort}") is an insurance company authorized to transact business in ${D.state} which issued policy number ${D.policyNumber} to ${D.employerShort}, providing liability coverage of ${D.policyLimits} per occurrence. ${D.liabilityInsurerShort} is named as a direct defendant pursuant to Wis. Stat. sec. 632.24.`,
      `Defendant ${D.uimInsurer} ("${D.uimInsurerShort}") issued policy number ${D.uimPolicyNumber} to ${D.plaintiffShort}, which policy provides underinsured motorist coverage in the amount of ${D.uimLimits}. ${D.uimInsurerShort} is named as a defendant for purposes of the underinsured motorist claim pleaded below.`,
    ]),
    gap(),
    h("JURISDICTION AND VENUE"),
    ...numbered(6, [
      `This Court has jurisdiction over the subject matter and the parties. Venue is proper in ${D.county} County pursuant to Wis. Stat. sec. 801.50(2)(a) because the claim arose in this county.`,
      `This action is commenced within the period allowed by Wis. Stat. sec. 893.54.`,
    ]),
    gap(),
    h("FACTS"),
    ...numbered(8, [
      `On ${D.crashDate}, at approximately ${D.crashTime}, ${D.plaintiffShort} was operating his vehicle northbound on ${D.street} in ${D.neighborhood} of ${D.city}, ${D.county} County, ${D.state}.`,
      `At the same time and place, ${D.defendantShort} was operating a box truck owned by ${D.employerShort} westbound on ${D.crossStreet}, approaching the controlled intersection of ${D.street} and ${D.crossStreet}.`,
      `${D.defendantShort} failed to stop for a red traffic signal and entered the intersection against the signal, striking the driver's side of the vehicle operated by ${D.plaintiffShort}.`,
      `The impact rotated the plaintiff's vehicle approximately 130 degrees and drove it into a utility pole on the northeast corner of the intersection.`,
      `${D.witnessBus}, the operator of a transit bus stopped in the southbound lane of ${D.street}, observed the collision and gave a statement at the scene confirming that the northbound signal was green.`,
      `${D.witnessPassenger}, a passenger in a vehicle behind the plaintiff, likewise gave a statement confirming the plaintiff had a green signal.`,
      `Officer ${D.officer} of the ${D.city} Police Department investigated and issued ${D.defendantShort} a citation for violating a traffic signal.`,
      `${D.plaintiffShort} was transported by ambulance to ${D.hospital}, where imaging showed a burst fracture at L1 with retropulsion, a fracture of the left transverse processes at L2 and L3, and three fractured ribs on the left side.`,
    ]),
    gap(),
    h("FIRST CLAIM: NEGLIGENCE"),
    ...numbered(16, [
      `${D.defendantShort} was negligent in the operation of her vehicle with respect to lookout, management and control, and obedience to a traffic control signal.`,
      `The negligence of ${D.defendantShort} was a cause of the collision and of the injuries and damages sustained by ${D.plaintiffShort}.`,
      `${D.employerShort} is vicariously liable for the negligence of ${D.defendantShort} under the doctrine of respondeat superior, and is independently negligent in its hiring, training, retention and supervision of ${D.defendantShort} and in its maintenance of the vehicle she was operating.`,
      `As a direct and proximate result, ${D.plaintiffShort} has incurred past medical expenses of ${D.medicalSpecials}, will incur future medical expenses reasonably estimated at ${D.futureCare}, has sustained past wage loss of ${D.wageLoss}, has sustained a permanent impairment of earning capacity, and has endured past and future pain, suffering and disability.`,
    ]),
    gap(),
    h("SECOND CLAIM: UNDERINSURED MOTORIST BENEFITS"),
    ...numbered(20, [
      `${D.plaintiffShort} realleges the preceding paragraphs.`,
      `The damages sustained by ${D.plaintiffShort} exceed the ${D.policyLimits} liability limit available under the ${D.liabilityInsurerShort} policy.`,
      `${D.plaintiffShort} is an insured under the ${D.uimInsurerShort} policy and has complied with all conditions precedent, including notice of the underinsured motorist claim and preservation of subrogation rights.`,
      `${D.uimInsurerShort} is obligated to pay underinsured motorist benefits to the extent the plaintiff's damages exceed the available liability coverage, subject to the terms of the policy and Wis. Stat. sec. 632.32.`,
    ]),
    gap(),
    p(
      `WHEREFORE, the plaintiff demands judgment against the defendants for compensatory damages in an amount to be determined by a jury, together with costs, disbursements, statutory interest, and such other relief as the Court deems just. The plaintiff demands a trial by jury of twelve.`,
    ),
    gap(),
    p(`Dated at ${D.city}, Wisconsin this ${D.filingDate}.`),
    gap(),
    p(D.plaintiffFirm.toUpperCase()),
    p("Attorneys for Plaintiff"),
    gap(),
    p(`By: ${D.plaintiffCounsel}`),
    p(`State Bar No. ${D.barNumber}`),
    p(D.firmAddress),
    p(`${D.city}, Wisconsin ${D.zip}`),
    p(`Telephone: ${D.phonePlaintiffFirm}`),
    p(`Email: ${D.emailPlaintiffCounsel}`),
  ),
});

export const answer = () => ({
  file: "02-answer-and-affirmative-defenses.pdf",
  bates: "HOLLAND",
  batesStart: 40,
  body: blocks(
    caption("ANSWER AND AFFIRMATIVE DEFENSES"),
    p(
      `Defendants ${D.defendant} ("${D.defendantShort}"), ${D.employer} ("${D.employerShort}") and ${D.liabilityInsurer} ("${D.liabilityInsurerShort}"), by their attorneys ${D.defenseFirm}, answer the Complaint of ${D.plaintiff} ("${D.plaintiffShort}") as follows:`,
    ),
    gap(),
    h("ANSWER"),
    ...numbered(1, [
      `Answering paragraphs 1 through 5, these defendants admit that ${D.defendantShort} resides in ${D.county} County; admit that ${D.employerShort} is a domestic corporation; admit that ${D.liabilityInsurerShort} issued policy number ${D.policyNumber} with a per-occurrence limit of ${D.policyLimits}; and lack sufficient information to form a belief as to the remaining allegations and therefore deny them.`,
      `Answering paragraphs 6 and 7, these defendants admit jurisdiction and venue and deny the remaining allegations.`,
      `Answering paragraphs 8 through 10, these defendants admit that a collision occurred on ${D.crashDate} at the intersection of ${D.street} and ${D.crossStreet} involving vehicles operated by ${D.plaintiffShort} and ${D.defendantShort}, and deny each remaining allegation, specifically denying that ${D.defendantShort} entered the intersection against a red signal.`,
      `Answering paragraphs 11 through 13, these defendants lack sufficient information as to what ${D.witnessBus} and ${D.witnessPassenger} observed and therefore deny the allegations.`,
      `Answering paragraph 14, these defendants admit that a citation was issued and affirmatively allege that the citation was resolved without a finding of guilt, and that a traffic citation is not admissible to establish civil negligence.`,
      `Answering paragraph 15, these defendants admit that ${D.plaintiffShort} was transported to ${D.hospital}, and deny the nature, extent and permanency of any injury.`,
      `Answering paragraphs 16 through 23, these defendants deny each allegation and specifically deny that any negligence on their part caused the collision or any injury.`,
    ]),
    gap(),
    h("AFFIRMATIVE DEFENSES"),
    ...numbered(8, [
      `The Complaint fails to state a claim upon which relief can be granted.`,
      `Any recovery is barred or reduced under Wis. Stat. sec. 895.045(1) by the causal negligence of ${D.plaintiffShort}, who was travelling at a speed greater than was reasonable and prudent under the conditions then existing, failed to maintain a proper lookout, and failed to take available evasive action.`,
      `${D.plaintiffShort} failed to wear an available and functional safety belt at the time of the collision, and any award must be reduced accordingly under Wis. Stat. sec. 347.48(2m)(g).`,
      `The injuries and conditions alleged are the result of pre-existing degenerative disease of the lumbar spine and not of the collision. ${D.plaintiffShort} received care for low back complaints from ${D.chiropractor}, D.C., on eleven occasions in the twenty-four months preceding the collision.`,
      `${D.plaintiffShort} failed to mitigate his damages. He discontinued all treatment between ${D.gapStart} and ${D.gapEnd}, a period of approximately twelve weeks, and declined the home exercise program prescribed at discharge.`,
      `Any claim for lost earnings attributable to ${D.plaintiffBusiness} ("${D.plaintiffBusinessAcronym}") is a claim of a separate legal entity which is not a party to this action.`,
      `These defendants are entitled to a setoff or credit for all amounts paid or payable by collateral sources to the extent permitted by law.`,
      `These defendants reserve the right to assert additional defenses as discovery proceeds.`,
    ]),
    gap(),
    p(`WHEREFORE, these defendants demand judgment dismissing the Complaint on its merits, together with costs and disbursements, and demand a trial by jury of twelve.`),
    gap(),
    p(`Dated at ${D.city}, Wisconsin this ${D.answerDate}.`),
    gap(),
    p(D.defenseFirm.toUpperCase()),
    p("Attorneys for Defendants"),
    gap(),
    p(`By: ${D.defenseCounsel}`),
    p(`State Bar No. 1029744`),
    p(`${D.defenseCity}, Wisconsin`),
    p(`Telephone: ${D.phoneDefenseFirm}`),
    p(`Email: ${D.emailDefenseCounsel}`),
  ),
});

export const demand = () => ({
  file: "03-settlement-demand-letter.pdf",
  bates: "HOLLAND",
  batesStart: 61,
  body: blocks(
    p(D.plaintiffFirm.toUpperCase()),
    p(`${D.firmAddress} | ${D.city}, Wisconsin ${D.zip} | ${D.phonePlaintiffFirm}`),
    rule(),
    gap(),
    p(D.demandDate),
    gap(),
    p(`${D.adjuster}, Senior Claim Representative`),
    p(D.liabilityInsurer),
    p(`Direct: ${D.phoneAdjuster}`),
    p(`Claim No. ${D.claimNumber}`),
    p(`Policy No. ${D.policyNumber}`),
    p(`Insured: ${D.employer}`),
    p(`Claimant: ${D.plaintiff}, DOB ${D.dob}`),
    p(`Date of Loss: ${D.crashDate}`),
    gap(),
    p(`Dear Mr. ${D.adjuster.split(" ").slice(-1)[0]}:`),
    gap(),
    p(
      `This letter is a demand for settlement of the claim of ${D.plaintiff} ("${D.plaintiffShort}") arising from the collision of ${D.crashDate}. It is made in advance of the mediation scheduled next month and remains open for thirty days.`,
    ),
    gap(),
    h("LIABILITY"),
    p(
      `Your insured, ${D.defendant}, entered a controlled intersection against a red signal while operating a box truck in the course of her employment with ${D.employer}. Two independent witnesses gave statements at the scene. ${D.witnessBus} was operating a transit bus stopped in the opposing lane and had an unobstructed view of both signals. ${D.witnessPassenger} was in the vehicle immediately behind ${D.plaintiffShort}. Both confirm the northbound signal was green. Officer ${D.officer} issued a citation.`,
    ),
    p(
      `Your file asserts comparative negligence as to speed. The event data recorder from the truck records a pre-impact speed of 34 miles per hour in a 30 zone. There is no comparable data for the plaintiff's vehicle and no witness has described his speed as excessive. Wis. Stat. sec. 895.045(1) bars recovery only where the plaintiff's negligence is greater than that of the person against whom recovery is sought. On this record that comparison is not close.`,
    ),
    p(
      `Your file also asserts the safety belt defense. The emergency department record from ${D.hospital} documents a seat belt sign across the left chest and abdomen. The defense will not survive the medical record, and under Wis. Stat. sec. 347.48(2m)(g) it would cap at a reduction of fifteen percent even if it did.`,
    ),
    gap(),
    h("INJURIES AND TREATMENT"),
    p(
      `${D.plaintiffShort} sustained an L1 burst fracture with retropulsion into the canal, transverse process fractures at L2 and L3, and three left-sided rib fractures. He was admitted to ${D.hospital} for six days. ${D.surgeon}, M.D., performed a T12-L2 posterior instrumented fusion on ${D.surgeryDate} at ${D.hospital}. Post-operative care and imaging were provided through ${D.clinic} at ${D.clinicAddress}, medical record number ${D.mrn}, under ${D.treating}, M.D. He completed forty-one sessions at ${D.therapy}. Follow-up imaging was performed at ${D.imaging}.`,
    ),
    p(
      `Your file makes much of a gap in treatment between ${D.gapStart} and ${D.gapEnd}. The explanation is in the records. ${D.plaintiffShort} is the sole member of ${D.plaintiffBusiness} ("${D.plaintiffBusinessAcronym}") and had no short-term disability coverage. He returned to the shop in a brace against advice because the business had four contracts in progress and no one else who could run the machinery. He resumed care as soon as the last of those contracts closed out, and the fusion followed.`,
    ),
    gap(),
    h("SPECIAL DAMAGES"),
    p(`${D.hospital} (admission, surgery, six-day stay): ${D.hospitalBill}`),
    p(`${D.clinic} (surgical and follow-up care): ${D.surgeryBill}`),
    p(`${D.therapy} (forty-one sessions): ${D.therapyBill}`),
    p(`${D.imaging} (CT and MRI series): ${D.imagingBill}`),
    p(`Ambulance, emergency department, pharmacy, orthotics: the balance`),
    p(`Total past medical expense: ${D.medicalSpecials}`),
    p(`Past wage loss: ${D.wageLoss}`),
    p(`Future care, present value: ${D.futureCare}`),
    gap(),
    h("THE LIEN, AND WHY YOUR NUMBER DOES NOT WORK"),
    p(
      `${D.healthPlan} ("${D.healthPlanShort}") has asserted a subrogation interest of ${D.lienAsserted}. Your offer of ${D.offerAmount} does not survive contact with that number. After the lien and fees, an offer at that level leaves ${D.plaintiffShort} with a negative recovery for a spinal fusion and a permanent restriction against lifting more than twenty-five pounds.`,
    ),
    p(
      `Under ${D.state} law a subrogated insurer is not paid until the injured person has been made whole. Rimes v. State Farm Mut. Auto. Ins. Co., 106 Wis. 2d 263 (1982), and the cases following it, hold that where the recovery is less than the total loss, the subrogated carrier takes nothing from the fund until the insured is made whole. ${D.healthPlanShort} understands this; the number will come down once there is a settlement to apply it to. It does not come down in response to an offer that concedes nothing.`,
    ),
    gap(),
    h("DEMAND"),
    p(
      `Demand is made in the amount of ${D.demandAmount}. That figure reflects the ${D.policyLimits} available under the ${D.liabilityInsurerShort} policy and the balance under the underinsured motorist coverage issued by ${D.uimInsurer} under policy ${D.uimPolicyNumber}, whose consent to settle has been requested and which has been kept apprised throughout.`,
    ),
    p(
      `${D.plaintiffShort} is forty-five years old, has worked with his hands since he was seventeen, and now cannot lift a sheet of plywood onto a table saw. The permanency rating from ${D.treating} is fifteen percent to the body as a whole. A jury in ${D.county} County will hear that from a treating surgeon rather than from a records reviewer.`,
    ),
    gap(),
    p("Very truly yours,"),
    gap(),
    p(D.plaintiffCounsel),
    p(D.plaintiffFirm),
    p(`${D.phonePlaintiffFirm} | ${D.emailPlaintiffCounsel}`),
    gap(),
    p(`cc: ${D.defenseCounsel}, ${D.defenseFirm}`),
    p(`    ${D.uimInsurer}, Attn: Subrogation Unit`),
  ),
});

export const ime = () => ({
  file: "04-independent-medical-examination.pdf",
  bates: "HOLLAND",
  batesStart: 88,
  body: blocks(
    center("INDEPENDENT MEDICAL EXAMINATION"),
    center(`${D.imeDoctor}, M.D. | Orthopedic Surgery`),
    gap(),
    p(`Examinee: ${D.plaintiff}`),
    p(`Date of Birth: ${D.dob}`),
    p(`Date of Examination: ${D.imeDate}`),
    p(`Claim No. ${D.claimNumber}`),
    p(`Requested by: ${D.defenseCounsel}, ${D.defenseFirm}`),
    p(`On behalf of: ${D.liabilityInsurer}`),
    rule(),
    gap(),
    h("MATERIALS REVIEWED"),
    p(
      `Records of ${D.hospital} for the admission of ${D.crashDate}; operative report of ${D.surgeon}, M.D., dated ${D.surgeryDate}; office records of ${D.clinic} under ${D.treating}, M.D.; imaging from ${D.imaging}; therapy notes from ${D.therapy}; chiropractic records of ${D.chiropractor}, D.C., for the period preceding the collision; and the deposition transcript of ${D.plaintiff}.`,
    ),
    gap(),
    h("HISTORY"),
    p(
      `The examinee is a 45-year-old right-hand-dominant man who reports that on ${D.crashDate} his vehicle was struck on the driver's side by a box truck at the intersection of ${D.street} and ${D.crossStreet}. He describes immediate low back pain and difficulty breathing. He was taken by ambulance to ${D.hospital}.`,
    ),
    p(
      `He reports that he returned to work at ${D.plaintiffBusiness} approximately ten weeks after the collision, in a brace, and worked in that condition for roughly three months before resuming care and proceeding to surgery on ${D.surgeryDate}.`,
    ),
    gap(),
    h("PRIOR HISTORY"),
    p(
      `The records of ${D.chiropractor}, D.C., document eleven visits in the twenty-four months before the collision, with complaints recorded as lumbar stiffness and intermittent right-sided low back pain. The last such visit was approximately five months before ${D.crashDate}. There is no record of imaging, work restriction, or referral in that period.`,
    ),
    gap(),
    h("EXAMINATION"),
    p(
      `Gait is normal without assistive device. There is a well-healed midline posterior lumbar incision. Lumbar flexion is to 50 degrees, extension to 10 degrees, both with report of end-range discomfort. Motor examination is 5/5 in all lower extremity groups. Sensation is intact. Straight leg raise is negative bilaterally. There is no atrophy.`,
    ),
    gap(),
    h("IMAGING"),
    p(
      `CT of ${D.crashDate} demonstrates an L1 burst fracture with approximately 30 percent loss of anterior vertebral body height and mild retropulsion. The same study demonstrates multilevel degenerative disc disease at L3-4, L4-5 and L5-S1, with disc space narrowing, endplate sclerosis and facet hypertrophy. Post-operative imaging shows stable instrumentation without hardware failure and a solid arthrodesis.`,
    ),
    gap(),
    h("OPINIONS"),
    p(
      `1. The L1 burst fracture, the L2 and L3 transverse process fractures, and the left rib fractures were caused by the collision of ${D.crashDate}. That much is not in dispute.`,
    ),
    p(
      `2. The multilevel degenerative disease at L3-4, L4-5 and L5-S1 is long-standing and pre-existing. It is visible on the initial trauma CT taken within hours of the collision, and degenerative change of that degree does not develop in hours. The chiropractic treatment recorded before the collision is consistent with symptomatic degenerative disease predating this event.`,
    ),
    p(
      `3. In my opinion the collision produced a temporary aggravation of the pre-existing degenerative condition superimposed on a discrete traumatic fracture. The fracture has healed with a solid fusion. The examinee has reached maximum medical improvement.`,
    ),
    p(
      `4. I would assign a permanent partial impairment of five percent to the body as a whole, referable to the single-level fusion. The fifteen percent rating of ${D.treating}, M.D., in my opinion incorporates the degenerative condition, which is not attributable to this collision.`,
    ),
    p(
      `5. Appropriate permanent restriction is against repetitive lifting above fifty pounds. I do not find support for the twenty-five pound restriction imposed by the treating surgeon.`,
    ),
    p(
      `6. The interval without treatment between ${D.gapStart} and ${D.gapEnd} is of note. A patient with an unstable or progressing fracture does not typically work in a millwork shop for twelve weeks. The absence of treatment during that period is more consistent with a stable injury than with the ongoing disability described.`,
    ),
    gap(),
    p(
      `The opinions above are held to a reasonable degree of medical certainty and are based on the materials reviewed and the examination performed on ${D.imeDate}.`,
    ),
    gap(),
    p(`${D.imeDoctor}, M.D.`),
  ),
});

export const release = () => ({
  file: "05-settlement-agreement-and-release.pdf",
  bates: "HOLLAND",
  batesStart: 104,
  body: blocks(
    center("SETTLEMENT AGREEMENT AND RELEASE OF ALL CLAIMS"),
    gap(),
    p(
      `This Settlement Agreement and Release of All Claims is entered into on ${D.settlementDate} by and between ${D.plaintiff} ("${D.plaintiffShort}"), and ${D.defendant}, ${D.employer}, ${D.liabilityInsurer} and ${D.uimInsurer} (collectively, the "Released Parties"), in ${D.county} County Circuit Court Case No. ${D.docket}.`,
    ),
    gap(),
    h("1. CONSIDERATION"),
    p(
      `The Released Parties shall pay the total sum of ${D.settlementAmount}, allocated as follows: ${D.policyLimits} representing the full per-occurrence liability limit of ${D.liabilityInsurer} under policy ${D.policyNumber}, and the balance from ${D.uimInsurer} under the underinsured motorist coverage of policy ${D.uimPolicyNumber}. Payment shall be made within twenty-one days of execution and of receipt of the lien resolution described in Section 3.`,
    ),
    gap(),
    h("2. RELEASE"),
    p(
      `In consideration of the payment described above, ${D.plaintiffShort} releases and forever discharges the Released Parties from all claims, demands, actions and causes of action of every kind arising from the collision of ${D.crashDate}, including all claims for past and future medical expense, past and future wage loss, loss of earning capacity, and past and future pain, suffering and disability, whether now known or unknown.`,
    ),
    gap(),
    h("3. LIENS AND SUBROGATION"),
    p(
      `${D.healthPlan} asserted a subrogation interest of ${D.lienAsserted} arising from benefits paid on behalf of ${D.plaintiffShort}. Following negotiation conducted under the made-whole doctrine as stated in Rimes v. State Farm Mut. Auto. Ins. Co., 106 Wis. 2d 263 (1982), ${D.healthPlan} has agreed to accept ${D.lienResolved} in full satisfaction of that interest, and has executed a separate release to that effect.`,
    ),
    p(
      `${D.plaintiffShort} represents that no other lien, subrogation interest or right of reimbursement is outstanding, that he is not a Medicare beneficiary, and that he has not applied for Social Security Disability benefits. ${D.plaintiffShort} agrees to indemnify and hold the Released Parties harmless from any claim by any lienholder arising from the collision.`,
    ),
    gap(),
    h("4. DISTRIBUTION"),
    p(
      `The parties acknowledge that of the gross settlement of ${D.settlementAmount}, attorney fees and costs of litigation are payable to ${D.plaintiffFirm} under a written contingent fee agreement, the resolved lien of ${D.lienResolved} is payable to ${D.healthPlan}, and the net sum of ${D.netToClient} is payable to ${D.plaintiffShort}, whose taxpayer identification number of record is ${D.ssn}.`,
    ),
    gap(),
    h("5. NO ADMISSION"),
    p(
      `This settlement is a compromise of a disputed claim. The Released Parties expressly deny liability, and nothing in this Agreement is an admission of liability by any party.`,
    ),
    gap(),
    h("6. CONFIDENTIALITY"),
    p(
      `The parties agree that neither the amount of this settlement nor its terms shall be disclosed except as required by law, to tax advisors, to lienholders, or as necessary to enforce this Agreement.`,
    ),
    gap(),
    h("7. DISMISSAL"),
    p(
      `Within ten days of payment, counsel shall file a Stipulation and Order for Dismissal on the merits, with prejudice and without costs to any party, in ${D.county} County Circuit Court Case No. ${D.docket}, before the Honorable ${D.judge}.`,
    ),
    gap(),
    h("8. ENTIRE AGREEMENT"),
    p(
      `This Agreement contains the entire agreement of the parties, supersedes all prior negotiations, may be amended only in writing signed by all parties, and is governed by the law of the State of ${D.state}. ${D.plaintiffShort} acknowledges that he has read this Agreement, has had the advice of counsel, and signs it voluntarily.`,
    ),
    gap(),
    p(`Dated: ${D.settlementDate}`),
    gap(),
    p(`${D.plaintiff}, Plaintiff`),
    gap(),
    p(`${D.spouse}, spouse, as to any claim for loss of society and companionship`),
    gap(),
    p(`${D.plaintiffCounsel}, ${D.plaintiffFirm}, Attorneys for Plaintiff`),
    gap(),
    p(`${D.defenseCounsel}, ${D.defenseFirm}, Attorneys for Defendants`),
  ),
});

/**
 * A treatment chronology, which is what makes the file long enough to be split
 * into page ranges. Entries repeat the cast the way a real chart does, so a
 * token that shifts meaning at a seam shows up plainly.
 */
export const chronology = (visits) => {
  const providers = [
    [D.clinic, D.treating, "orthopedic follow-up"],
    [D.therapy, "the treating therapist", "physical therapy"],
    [D.clinic, D.surgeon, "post-surgical review"],
    [D.imaging, "the reading radiologist", "imaging"],
  ];
  const notes = [
    `Reports low back pain rated 6/10, worse with prolonged standing. Brace tolerated. Continue current restrictions.`,
    `Gait improving. Lumbar flexion to 40 degrees. Advised against return to shop work at this time; patient states he has no coverage and intends to return regardless.`,
    `Radiographs show maintained alignment at the fracture level. No hardware complication. Continue therapy.`,
    `Patient reports increased pain following two weeks of shop work. Counselled again on restrictions. Discussed risk of progressive kyphosis at the fracture level.`,
    `Therapy session completed. Tolerated lumbar stabilisation progression. Reports difficulty with overhead reaching.`,
    `Post-operative check. Incision well healed, no drainage. Sensation intact in both lower extremities.`,
    `Reports pain waking him at night approximately three times per week. Sleep disruption discussed. Non-narcotic regimen continued.`,
    `Work capacity discussed. Permanent restriction against lifting above twenty-five pounds recommended given fusion at the thoracolumbar junction.`,
  ];

  const body = [
    center("TREATMENT CHRONOLOGY"),
    p(`Patient: ${D.plaintiff}   DOB: ${D.dob}   MRN: ${D.mrn}`),
    p(`Date of Injury: ${D.crashDate}`),
    p(`Prepared for: ${D.plaintiffCounsel}, ${D.plaintiffFirm}`),
    p(`Claim No. ${D.claimNumber}`),
    rule(),
    gap(),
  ];

  const start = new Date(2022, 5, 12);
  for (let i = 0; i < visits; i += 1) {
    const when = new Date(start.getTime() + (i + 1) * 9 * 86400000);
    const date = when.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const [facility, provider, kind] = providers[i % providers.length];
    body.push(h(`${date} - ${facility}`));
    body.push(
      p(
        `${kind} with ${provider}. ${notes[i % notes.length]} Patient identified as ${D.plaintiff}, MRN ${D.mrn}. Billing routed to ${D.healthPlan} under the claim of ${D.liabilityInsurer}, claim number ${D.claimNumber}.`,
      ),
    );
    body.push(gap());
  }

  return { file: "06-treatment-chronology.pdf", bates: "HOLLAND", batesStart: 130, body };
};
