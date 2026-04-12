import { PrismaClient, Department, TestType, FieldType } from "@prisma/client";

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Tests...");

  // ── Seed Test Categories ─────────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.testCategory.upsert({
      where: { id: "cat-haematology" },
      update: {},
      create: { id: "cat-haematology", name: "Haematology", description: "Blood count and related tests" },
    }),
    prisma.testCategory.upsert({
      where: { id: "cat-chemistry" },
      update: {},
      create: { id: "cat-chemistry", name: "Clinical Chemistry", description: "Biochemistry and metabolic tests" },
    }),
    prisma.testCategory.upsert({
      where: { id: "cat-micro" },
      update: {},
      create: { id: "cat-micro", name: "Microbiology", description: "Infection and parasitology tests" },
    }),
    prisma.testCategory.upsert({
      where: { id: "cat-urine" },
      update: {},
      create: { id: "cat-urine", name: "Urinalysis", description: "Urine examination tests" },
    }),
    prisma.testCategory.upsert({
      where: { id: "cat-imaging" },
      update: {},
      create: { id: "cat-imaging", name: "Imaging & Radiology", description: "X-Ray, Ultrasound, CT, MRI" },
    }),
    prisma.testCategory.upsert({
      where: { id: "cat-serology" },
      update: {},
      create: { id: "cat-serology", name: "Serology / Immunology", description: "Antibody and antigen tests" },
    }),
  ]);

  console.log(`✅ ${categories.length} test categories created`);

  // ── Get Organization ─────────────────────────────────────────────────────
  const org = await prisma.organization.findFirst();

  if (!org) {
    throw new Error("No organization found. Please create one first.");
  }

  const orgId = org.id;
  console.log(`✅ Organization found: ${org.name}`);

  // ── Helper: upsert test + fields ────────────────────────────────────────
  async function seedTest(data: {
    code: string;
    name: string;
    type: TestType;
    department: Department;
    categoryId: string;
    price: number;
    turnaroundMinutes: number;
    sampleType?: string;
    description?: string;
    fields: {
      label: string;
      fieldKey: string;
      fieldType: FieldType;
      unit?: string;
      normalMin?: number;
      normalMax?: number;
      options?: string;
      isRequired?: boolean;
      sortOrder: number;
    }[];
  }) {
    const test = await prisma.diagnosticTest.upsert({
      where: { organizationId_code: { organizationId: orgId, code: data.code } },
      update: { name: data.name, price: data.price },
      create: {
        organizationId: orgId,
        categoryId: data.categoryId,
        name: data.name,
        code: data.code,
        type: data.type,
        department: data.department,
        price: data.price,
        turnaroundMinutes: data.turnaroundMinutes,
        sampleType: data.sampleType,
        description: data.description,
      },
    });

    await prisma.resultTemplateField.deleteMany({ where: { testId: test.id } });
    await prisma.resultTemplateField.createMany({
      data: data.fields.map((field) => ({
        testId: test.id,
        label: field.label,
        fieldKey: field.fieldKey,
        fieldType: field.fieldType,
        unit: field.unit,
        normalMin: field.normalMin,
        normalMax: field.normalMax,
        options: field.options,
        isRequired: field.isRequired ?? true,
        sortOrder: field.sortOrder,
      })),
    });

    return test;
  }

  // ── LAB TESTS ────────────────────────────────────────────────────────────

  // 1. Full Blood Count
  await seedTest({
    code: "FBC",
    name: "Full Blood Count",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-haematology",
    price: 3500,
    turnaroundMinutes: 120,
    sampleType: "EDTA Blood",
    description: "Complete blood count including WBC differential",
    fields: [
      { label: "Haemoglobin", fieldKey: "haemoglobin", fieldType: FieldType.NUMBER, unit: "g/dL", normalMin: 12, normalMax: 17, sortOrder: 1 },
      { label: "PCV / Haematocrit", fieldKey: "pcv", fieldType: FieldType.NUMBER, unit: "%", normalMin: 36, normalMax: 50, sortOrder: 2 },
      { label: "WBC Count", fieldKey: "wbc", fieldType: FieldType.NUMBER, unit: "×10³/µL", normalMin: 4, normalMax: 11, sortOrder: 3 },
      { label: "Neutrophils", fieldKey: "neutrophils", fieldType: FieldType.NUMBER, unit: "%", normalMin: 40, normalMax: 75, sortOrder: 4 },
      { label: "Lymphocytes", fieldKey: "lymphocytes", fieldType: FieldType.NUMBER, unit: "%", normalMin: 20, normalMax: 45, sortOrder: 5 },
      { label: "Monocytes", fieldKey: "monocytes", fieldType: FieldType.NUMBER, unit: "%", normalMin: 2, normalMax: 10, sortOrder: 6 },
      { label: "Eosinophils", fieldKey: "eosinophils", fieldType: FieldType.NUMBER, unit: "%", normalMin: 1, normalMax: 6, sortOrder: 7 },
      { label: "Platelets", fieldKey: "platelets", fieldType: FieldType.NUMBER, unit: "×10³/µL", normalMin: 150, normalMax: 400, sortOrder: 8 },
      { label: "MCV", fieldKey: "mcv", fieldType: FieldType.NUMBER, unit: "fL", normalMin: 80, normalMax: 100, sortOrder: 9 },
      { label: "MCH", fieldKey: "mch", fieldType: FieldType.NUMBER, unit: "pg", normalMin: 27, normalMax: 33, sortOrder: 10 },
      { label: "MCHC", fieldKey: "mchc", fieldType: FieldType.NUMBER, unit: "g/dL", normalMin: 32, normalMax: 36, sortOrder: 11 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 12 },
    ],
  });

  // 2. Malaria Parasite
  await seedTest({
    code: "MP",
    name: "Malaria Parasite",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-micro",
    price: 1500,
    turnaroundMinutes: 60,
    sampleType: "EDTA Blood",
    description: "Thick and thin film for malaria parasite",
    fields: [
      { label: "Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative", sortOrder: 1 },
      { label: "Species", fieldKey: "species", fieldType: FieldType.DROPDOWN, options: "Plasmodium falciparum,Plasmodium vivax,Plasmodium malariae,Mixed,Not Applicable", isRequired: false, sortOrder: 2 },
      { label: "Parasitaemia", fieldKey: "parasitaemia", fieldType: FieldType.DROPDOWN, options: "+,++,+++,++++,Not Applicable", isRequired: false, sortOrder: 3 },
      { label: "Method", fieldKey: "method", fieldType: FieldType.DROPDOWN, options: "Thick Film,Thin Film,RDT", sortOrder: 4 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    ],
  });

  // 3. Urinalysis
  await seedTest({
    code: "URA",
    name: "Urinalysis",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-urine",
    price: 1500,
    turnaroundMinutes: 60,
    sampleType: "Mid-stream Urine",
    fields: [
      { label: "Colour", fieldKey: "colour", fieldType: FieldType.DROPDOWN, options: "Pale Yellow,Yellow,Dark Yellow,Amber,Brown,Red,Colourless", sortOrder: 1 },
      { label: "Appearance", fieldKey: "appearance", fieldType: FieldType.DROPDOWN, options: "Clear,Slightly Turbid,Turbid,Very Turbid", sortOrder: 2 },
      { label: "pH", fieldKey: "ph", fieldType: FieldType.NUMBER, unit: "", normalMin: 4.5, normalMax: 8, sortOrder: 3 },
      { label: "Specific Gravity", fieldKey: "specific_gravity", fieldType: FieldType.TEXT, sortOrder: 4 },
      { label: "Protein", fieldKey: "protein", fieldType: FieldType.DROPDOWN, options: "Negative,Trace,+,++,+++", sortOrder: 5 },
      { label: "Glucose", fieldKey: "glucose", fieldType: FieldType.DROPDOWN, options: "Negative,Trace,+,++,+++", sortOrder: 6 },
      { label: "Ketones", fieldKey: "ketones", fieldType: FieldType.DROPDOWN, options: "Negative,Trace,+,++,+++", sortOrder: 7 },
      { label: "Blood", fieldKey: "blood", fieldType: FieldType.DROPDOWN, options: "Negative,Trace,+,++,+++", sortOrder: 8 },
      { label: "Bilirubin", fieldKey: "bilirubin", fieldType: FieldType.DROPDOWN, options: "Negative,+,++,+++", sortOrder: 9 },
      { label: "Urobilinogen", fieldKey: "urobilinogen", fieldType: FieldType.DROPDOWN, options: "Normal,Increased", sortOrder: 10 },
      { label: "Nitrite", fieldKey: "nitrite", fieldType: FieldType.DROPDOWN, options: "Negative,Positive", sortOrder: 11 },
      { label: "Leucocytes", fieldKey: "leucocytes", fieldType: FieldType.DROPDOWN, options: "Negative,Trace,+,++,+++", sortOrder: 12 },
      { label: "Pus Cells (hpf)", fieldKey: "pus_cells", fieldType: FieldType.TEXT, sortOrder: 13 },
      { label: "RBCs (hpf)", fieldKey: "rbcs", fieldType: FieldType.TEXT, sortOrder: 14 },
      { label: "Epithelial Cells", fieldKey: "epithelial_cells", fieldType: FieldType.DROPDOWN, options: "Nil,Few,Moderate,Many", isRequired: false, sortOrder: 15 },
      { label: "Casts", fieldKey: "casts", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 16 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 17 },
    ],
  });

  // 4. Fasting Blood Sugar
  await seedTest({
    code: "FBS",
    name: "Fasting Blood Sugar",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-chemistry",
    price: 1500,
    turnaroundMinutes: 60,
    sampleType: "Fluoride Oxalate Blood",
    fields: [
      { label: "Glucose Level", fieldKey: "glucose", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 3.9, normalMax: 5.5, sortOrder: 1 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    ],
  });

  // 5. Random Blood Sugar
  await seedTest({
    code: "RBS",
    name: "Random Blood Sugar",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-chemistry",
    price: 1500,
    turnaroundMinutes: 30,
    sampleType: "Fluoride Oxalate Blood",
    fields: [
      { label: "Glucose Level", fieldKey: "glucose", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 3.9, normalMax: 7.8, sortOrder: 1 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    ],
  });

  // 6. Widal Test
  await seedTest({
    code: "WIDAL",
    name: "Widal Test",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-serology",
    price: 2000,
    turnaroundMinutes: 90,
    sampleType: "Serum",
    fields: [
      { label: "S. Typhi O", fieldKey: "typhi_o", fieldType: FieldType.DROPDOWN, options: "Negative,1:20,1:40,1:80,1:160,1:320,1:640", sortOrder: 1 },
      { label: "S. Typhi H", fieldKey: "typhi_h", fieldType: FieldType.DROPDOWN, options: "Negative,1:20,1:40,1:80,1:160,1:320,1:640", sortOrder: 2 },
      { label: "S. Paratyphi AO", fieldKey: "paratyphi_ao", fieldType: FieldType.DROPDOWN, options: "Negative,1:20,1:40,1:80,1:160,1:320", sortOrder: 3 },
      { label: "S. Paratyphi BH", fieldKey: "paratyphi_bh", fieldType: FieldType.DROPDOWN, options: "Negative,1:20,1:40,1:80,1:160,1:320", sortOrder: 4 },
      { label: "Interpretation", fieldKey: "interpretation", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
    ],
  });

  // 7. Liver Function Test
  await seedTest({
    code: "LFT",
    name: "Liver Function Test",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-chemistry",
    price: 5000,
    turnaroundMinutes: 180,
    sampleType: "Serum",
    fields: [
      { label: "Total Bilirubin", fieldKey: "total_bilirubin", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 3.4, normalMax: 20.5, sortOrder: 1 },
      { label: "Direct Bilirubin", fieldKey: "direct_bilirubin", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 0, normalMax: 5.1, sortOrder: 2 },
      { label: "Indirect Bilirubin", fieldKey: "indirect_bilirubin", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 0, normalMax: 17, sortOrder: 3 },
      { label: "ALT (SGPT)", fieldKey: "alt", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 7, normalMax: 40, sortOrder: 4 },
      { label: "AST (SGOT)", fieldKey: "ast", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 10, normalMax: 40, sortOrder: 5 },
      { label: "ALP", fieldKey: "alp", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 44, normalMax: 147, sortOrder: 6 },
      { label: "Total Protein", fieldKey: "total_protein", fieldType: FieldType.NUMBER, unit: "g/L", normalMin: 60, normalMax: 83, sortOrder: 7 },
      { label: "Albumin", fieldKey: "albumin", fieldType: FieldType.NUMBER, unit: "g/L", normalMin: 35, normalMax: 50, sortOrder: 8 },
      { label: "Globulin", fieldKey: "globulin", fieldType: FieldType.NUMBER, unit: "g/L", normalMin: 20, normalMax: 35, sortOrder: 9 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 10 },
    ],
  });

  // 8. Kidney Function Test
  await seedTest({
    code: "KFT",
    name: "Kidney Function Test",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-chemistry",
    price: 5000,
    turnaroundMinutes: 180,
    sampleType: "Serum",
    fields: [
      { label: "Urea", fieldKey: "urea", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 2.5, normalMax: 7.1, sortOrder: 1 },
      { label: "Creatinine", fieldKey: "creatinine", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 62, normalMax: 115, sortOrder: 2 },
      { label: "Uric Acid", fieldKey: "uric_acid", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 0.15, normalMax: 0.45, sortOrder: 3 },
      { label: "Sodium", fieldKey: "sodium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 136, normalMax: 145, sortOrder: 4 },
      { label: "Potassium", fieldKey: "potassium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 3.5, normalMax: 5.0, sortOrder: 5 },
      { label: "Chloride", fieldKey: "chloride", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 98, normalMax: 107, sortOrder: 6 },
      { label: "Bicarbonate", fieldKey: "bicarbonate", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 22, normalMax: 29, sortOrder: 7 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 8 },
    ],
  });

  // 9. HBsAg
  await seedTest({
    code: "HBSAG",
    name: "Hepatitis B Surface Antigen (HBsAg)",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-serology",
    price: 2500,
    turnaroundMinutes: 60,
    sampleType: "Serum",
    fields: [
      { label: "Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
      { label: "Method", fieldKey: "method", fieldType: FieldType.DROPDOWN, options: "Rapid Strip,ELISA", sortOrder: 2 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
    ],
  });

  // 10. HIV Screening
  await seedTest({
    code: "HIV",
    name: "HIV Screening",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-serology",
    price: 2000,
    turnaroundMinutes: 60,
    sampleType: "Serum / Whole Blood",
    fields: [
      { label: "Determine Result", fieldKey: "determine", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
      { label: "Unigold Result", fieldKey: "unigold", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive,Not Done", sortOrder: 2 },
      { label: "Final Interpretation", fieldKey: "interpretation", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Inconclusive", sortOrder: 3 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    ],
  });

  // 11. Stool Analysis
  await seedTest({
    code: "STOOL",
    name: "Stool Analysis",
    type: TestType.LAB,
    department: Department.LABORATORY,
    categoryId: "cat-micro",
    price: 1500,
    turnaroundMinutes: 90,
    sampleType: "Stool",
    fields: [
      { label: "Colour", fieldKey: "colour", fieldType: FieldType.DROPDOWN, options: "Brown,Yellow,Black,Green,Red,Pale", sortOrder: 1 },
      { label: "Consistency", fieldKey: "consistency", fieldType: FieldType.DROPDOWN, options: "Formed,Semi-formed,Loose,Watery", sortOrder: 2 },
      { label: "Mucus", fieldKey: "mucus", fieldType: FieldType.DROPDOWN, options: "Absent,Present", sortOrder: 3 },
      { label: "Blood", fieldKey: "blood", fieldType: FieldType.DROPDOWN, options: "Absent,Present", sortOrder: 4 },
      { label: "Ova / Cyst", fieldKey: "ova_cyst", fieldType: FieldType.TEXT, sortOrder: 5 },
      { label: "Trophozoites", fieldKey: "trophozoites", fieldType: FieldType.TEXT, sortOrder: 6 },
      { label: "Pus Cells (hpf)", fieldKey: "pus_cells", fieldType: FieldType.TEXT, sortOrder: 7 },
      { label: "RBCs (hpf)", fieldKey: "rbcs", fieldType: FieldType.TEXT, sortOrder: 8 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 9 },
    ],
  });

  // ── RADIOLOGY TESTS ──────────────────────────────────────────────────────

  // 12. Chest X-Ray
  await seedTest({
    code: "CXR",
    name: "Chest X-Ray",
    type: TestType.RADIOLOGY,
    department: Department.RADIOLOGY,
    categoryId: "cat-imaging",
    price: 5000,
    turnaroundMinutes: 45,
    description: "Plain chest radiograph (PA view)",
    fields: [
      { label: "Projection / View", fieldKey: "projection", fieldType: FieldType.DROPDOWN, options: "PA,AP,Lateral,AP + Lateral", sortOrder: 1 },
      { label: "Lung Fields", fieldKey: "lung_fields", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
      { label: "Heart Size", fieldKey: "heart_size", fieldType: FieldType.DROPDOWN, options: "Normal,Mildly Enlarged,Moderately Enlarged,Markedly Enlarged", sortOrder: 3 },
      { label: "Mediastinum", fieldKey: "mediastinum", fieldType: FieldType.TEXTAREA, sortOrder: 4 },
      { label: "Diaphragm", fieldKey: "diaphragm", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
      { label: "Costophrenic Angles", fieldKey: "costophrenic", fieldType: FieldType.DROPDOWN, options: "Sharp bilaterally,Blunted on right,Blunted on left,Blunted bilaterally", sortOrder: 6 },
      { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 7 },
      { label: "Recommendation", fieldKey: "recommendation", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 8 },
    ],
  });

  // 13. Abdominal Ultrasound
  await seedTest({
    code: "AUS",
    name: "Abdominal Ultrasound",
    type: TestType.RADIOLOGY,
    department: Department.RADIOLOGY,
    categoryId: "cat-imaging",
    price: 8000,
    turnaroundMinutes: 60,
    description: "Comprehensive abdominal ultrasound scan",
    fields: [
      { label: "Liver", fieldKey: "liver", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
      { label: "Gallbladder", fieldKey: "gallbladder", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
      { label: "Spleen", fieldKey: "spleen", fieldType: FieldType.TEXTAREA, sortOrder: 3 },
      { label: "Pancreas", fieldKey: "pancreas", fieldType: FieldType.TEXTAREA, sortOrder: 4 },
      { label: "Kidneys", fieldKey: "kidneys", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
      { label: "Urinary Bladder", fieldKey: "bladder", fieldType: FieldType.TEXTAREA, sortOrder: 6 },
      { label: "Aorta / IVC", fieldKey: "aorta", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 7 },
      { label: "Free Fluid / Ascites", fieldKey: "free_fluid", fieldType: FieldType.DROPDOWN, options: "None detected,Minimal,Moderate,Gross", sortOrder: 8 },
      { label: "Other Findings", fieldKey: "other_findings", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 9 },
      { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 10 },
      { label: "Recommendation", fieldKey: "recommendation", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 11 },
    ],
  });

  // 14. Pelvic Ultrasound
  await seedTest({
    code: "PUS",
    name: "Pelvic Ultrasound",
    type: TestType.RADIOLOGY,
    department: Department.RADIOLOGY,
    categoryId: "cat-imaging",
    price: 7000,
    turnaroundMinutes: 60,
    fields: [
      { label: "Uterus", fieldKey: "uterus", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
      { label: "Ovaries", fieldKey: "ovaries", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
      { label: "Endometrium", fieldKey: "endometrium", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
      { label: "Adnexa", fieldKey: "adnexa", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
      { label: "Pouch of Douglas", fieldKey: "pod", fieldType: FieldType.DROPDOWN, options: "Clear,Fluid noted", sortOrder: 5 },
      { label: "Other Findings", fieldKey: "other_findings", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
      { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 7 },
      { label: "Recommendation", fieldKey: "recommendation", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 8 },
    ],
  });

  // 15. Obstetric Ultrasound
  await seedTest({
    code: "OBS",
    name: "Obstetric Ultrasound",
    type: TestType.RADIOLOGY,
    department: Department.RADIOLOGY,
    categoryId: "cat-imaging",
    price: 8000,
    turnaroundMinutes: 60,
    fields: [
      { label: "Gestational Age (LMP)", fieldKey: "ga_lmp", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 1 },
      { label: "Gestational Age (Scan)", fieldKey: "ga_scan", fieldType: FieldType.TEXT, sortOrder: 2 },
      { label: "Number of Fetuses", fieldKey: "fetus_count", fieldType: FieldType.DROPDOWN, options: "Singleton,Twins,Triplets", sortOrder: 3 },
      { label: "Fetal Lie", fieldKey: "fetal_lie", fieldType: FieldType.DROPDOWN, options: "Longitudinal,Transverse,Oblique", sortOrder: 4 },
      { label: "Fetal Presentation", fieldKey: "presentation", fieldType: FieldType.DROPDOWN, options: "Cephalic,Breech,Shoulder", sortOrder: 5 },
      { label: "Fetal Heart Rate", fieldKey: "fhr", fieldType: FieldType.NUMBER, unit: "bpm", normalMin: 110, normalMax: 160, sortOrder: 6 },
      { label: "Placenta Location", fieldKey: "placenta", fieldType: FieldType.TEXT, sortOrder: 7 },
      { label: "Amniotic Fluid", fieldKey: "amniotic_fluid", fieldType: FieldType.DROPDOWN, options: "Adequate,Reduced (Oligohydramnios),Increased (Polyhydramnios)", sortOrder: 8 },
      { label: "BPD", fieldKey: "bpd", fieldType: FieldType.NUMBER, unit: "cm", isRequired: false, sortOrder: 9 },
      { label: "HC", fieldKey: "hc", fieldType: FieldType.NUMBER, unit: "cm", isRequired: false, sortOrder: 10 },
      { label: "AC", fieldKey: "ac", fieldType: FieldType.NUMBER, unit: "cm", isRequired: false, sortOrder: 11 },
      { label: "FL", fieldKey: "fl", fieldType: FieldType.NUMBER, unit: "cm", isRequired: false, sortOrder: 12 },
      { label: "EFW", fieldKey: "efw", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 13 },
      { label: "EDD", fieldKey: "edd", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 14 },
      { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 15 },
    ],
  });

  // 16. Skull X-Ray
  await seedTest({
    code: "SKX",
    name: "Skull X-Ray",
    type: TestType.RADIOLOGY,
    department: Department.RADIOLOGY,
    categoryId: "cat-imaging",
    price: 5000,
    turnaroundMinutes: 45,
    fields: [
      { label: "Projection / View", fieldKey: "projection", fieldType: FieldType.DROPDOWN, options: "AP,Lateral,Towne's,Submentovertex", sortOrder: 1 },
      { label: "Skull Vault", fieldKey: "skull_vault", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
      { label: "Sella Turcica", fieldKey: "sella", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
      { label: "Pineal Gland", fieldKey: "pineal", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
      { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
      { label: "Recommendation", fieldKey: "recommendation", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
    ],
  });

  // 17. Bulk catalog expansion (Lab + Radiology master list)
  const extraCategories = await Promise.all([
    prisma.testCategory.upsert({
      where: { id: "cat-molecular" },
      update: {},
      create: { id: "cat-molecular", name: "Molecular / PCR", description: "Molecular diagnostics and PCR assays" },
    }),
    prisma.testCategory.upsert({
      where: { id: "cat-cardiac" },
      update: {},
      create: { id: "cat-cardiac", name: "Cardiac Markers", description: "Cardiac and heart-related markers" },
    }),
  ]);
  console.log(`✅ ${extraCategories.length} additional categories ready`);

  const rawLabTests = [
    "ALKALINE PHOSPHATASE (ALP)",
    "B10 CHEMISTRY PANEL HBA1C",
    "LIPID PROFILE",
    "TRIGLYCERIDE",
    "CHOLESTEROL (TOTAL)",
    "HDL-C",
    "AST (SGOT)",
    "ALT (SGPT)",
    "GGT",
    "TOTAL BILIRUBIN",
    "DIRECT BILIRUBIN",
    "LDL-C",
    "PROTEIN (TOTAL)",
    "VLDL-C",
    "ALBUMIN",
    "THYROID STIMULATING HORMONE (TSH)",
    "THYROXINE (T4 FREE)",
    "THYROXINE (T4 TOTAL)",
    "TRIIODOTHYRONINE (T3 TOTAL)",
    "TRIIODOTHYRONINE (T3 FREE)",
    "ELECTROLYTES",
    "UREA",
    "CREATININE",
    "BLOOD GASES",
    "BLOOD PH",
    "OXYGEN (O2)",
    "CARBON DIOXIDE (CO2)",
    "CALCIUM (TOTAL)",
    "IONIZED CALCIUM",
    "LACTATE",
    "URIC ACID",
    "PREGNANCY TEST",
    "CRP",
    "CREATINE KINASE",
    "PROCALCITONIN",
    "AMYLASE",
    "COMPREHENSIVE METABOLIC PANEL (CMP)",
    "PROTEIN ELECTROPHORESIS",
    "PROSTATE SPECIFIC ANTIGEN (PSA)",
    "PROSTATE SPECIFIC ANTIGEN (FREE)",
    "CARCINOEMBRYONIC ANTIGEN (CEA)",
    "ALPHA-FETOPROTEIN (AFP)",
    "CA-125 TEST",
    "CD4 T CELL COUNT",
    "CD4 T CELL PERCENTAGE",
    "CD8 T CELL COUNT",
    "HIV 1 & II CONFIRMATORY TEST",
    "HUMAN CHORIONIC GONADOTROPIN (B-HCG)",
    "PROGESTERONE",
    "FOLLICLE STIMULATING HORMONE (FSH)",
    "LUTEINIZING HORMONE (LH)",
    "PROLACTIN",
    "OESTROGEN (E2)",
    "VITAMIN B12",
    "VITAMIN D",
    "FERRITIN",
    "PARATHYROID HORMONE (PTH)",
    "DEHYDROEPIANDROSTERONE SULFATE (DHEA-S)",
    "CORTISOL",
    "TESTOSTERONE",
    "MICROALBUMIN",
    "ADRENOCORTICOTROPIC HORMONE (ACTH)",
    "HBsAg-QUANTITATIVE",
    "HUMAN GROWTH HORMONE",
    "ANTI NUCLEAR ANTIBODY (ANA)",
    "DOUBLE STRANDED DNA TEST (ds-DNA)",
    "BRAIN NATRIURETIC PEPTIDE (NT-proBNP)",
    "CK-MB",
    "TROPONIN T",
    "TROPONIN I",
    "PROSTATE BIOPSY",
    "LIVER BIOPSY",
    "HBV 5 PANEL TEST",
    "HBsAb-QUANTITATIVE",
    "HBeAg-QUANTITATIVE",
    "HBeAb-QUANTITATIVE",
    "HBcAb-QUANTITATIVE",
    "HBV DNA PANEL",
    "HBsAg-QUALITATIVE",
    "HBsAb-QUALITATIVE",
    "HBeAg-QUALITATIVE",
    "HBeAb-QUALITATIVE",
    "HBcAb-QUALITATIVE",
    "URINE M/C/S",
    "STOOL M/C/S",
    "SPUTUM M/C/S",
    "BLOOD CULTURE/SENSITIVITY",
    "HIGH VAGINAL SWAB (HVS) M/C/S",
    "ENDOCERVICAL SWAB (ECS) M/C/S",
    "URETHRAL SWAB M/C/S",
    "SEMEN M/C/S",
    "SKIN/NAIL SCRAPING M/C/S",
    "OTHER SWABS/FLUID M/C/S",
    "URINALYSIS",
    "STOOL ANALYSIS",
    "SEMEN ANALYSIS",
    "SPUTUM AFB (X2)",
    "HIV SCREENING",
    "GRAM STAINING",
    "MANTOUX TEST",
    "SKIN SCRAPING ANALYSIS",
    "H. PYLORI SCREENING",
    "ASO TITRE",
    "RHEUMATOID FACTOR",
    "HEPATITIS A SCREENING",
    "BLOOD FILM",
    "MALARIA PARASITES (MP)",
    "BLOOD GROUP",
    "GENOTYPE",
    "DIRECT COOMBS TEST",
    "INDIRECT COOMBS TEST",
    "CROSS MATCHING",
    "HB ELECTROPHORESIS",
    "GENOTYPING (CONFIRMATORY)",
    "PROTHROMBIN TIME",
    "APTT",
    "FIBRINOGEN",
    "ESR",
    "HAEMOGLOBIN (HB)",
    "DNA PATERNITY TEST",
    "HBV DNA VIRAL LOAD",
    "HBV RNA BY RT-PCR",
    "HCV RNA VIRAL LOAD",
    "HCV GENOTYPING",
    "TUBERCULOSIS ANTIGEN TEST",
    "HBV QUALITATIVE (CONFIRMATORY TEST)",
    "HCV QUALITATIVE (CONFIRMATORY TEST)",
    "HEPATITIS B SCREENING",
    "HEPATITIS C SCREENING",
    "CHLAMYDIA",
    "VDRL",
    "BRUCELLA SCREENING",
  ];

  const rawRadiologyTests = [
    "ABDOMINAL SCAN",
    "PELVIC SCAN",
    "OBSTETRIC/FETAL ULTRASOUND",
    "BREAST SCAN",
    "OCCULAR SCAN",
    "TRANSRECTAL/PROSTATE SCAN",
    "FOLLICULOMETRY",
    "SONO-HSG",
    "ECHOCARDIOGRAM",
    "PROSTATE BIOPSY (ULTRASOUND GUIDED)",
    "LIVER BIOPSY (ULTRASOUND GUIDED)",
    "KIDNEY BIOPSY (ULTRASOUND GUIDED)",
    "BREAST BIOPSY (ULTRASOUND GUIDED)",
    "THYROID BIOPSY (ULTRASOUND GUIDED)",
    "DOPPLER STUDY",
    "DIGITAL X-RAY SKULL",
    "DIGITAL X-RAY MANDIBLE",
    "DIGITAL X-RAY TMJ",
    "DIGITAL X-RAY CHEST",
    "DIGITAL X-RAY SHOULDER",
    "DIGITAL X-RAY HUMERUS",
    "DIGITAL X-RAY ELBOW",
    "DIGITAL X-RAY FOREARM",
    "DIGITAL X-RAY WRIST",
    "DIGITAL X-RAY HAND",
    "DIGITAL X-RAY CERVICAL SPINE",
    "DIGITAL X-RAY THORACIC SPINE",
    "DIGITAL X-RAY LUMBO-SACRAL SPINE",
    "DIGITAL X-RAY PELVIS/HIP",
    "DIGITAL X-RAY FEMUR",
    "DIGITAL X-RAY KNEE",
    "DIGITAL X-RAY TIBIA-FIBULA",
    "DIGITAL X-RAY ANKLE",
    "DIGITAL X-RAY FOOT",
    "DIGITAL X-RAY PARANASAL SINUSES",
    "DIGITAL X-RAY POST NASAL SPACE",
    "DIGITAL X-RAY TRANS-CRANIAL",
    "BARIUM MEAL/FOLLOW THROUGH",
    "BARIUM SWALLOW",
    "BARIUM ENEMA",
    "INTRAVENOUS UROGRAPHY (IVU)",
    "HYSTEROSALPINGOGRAPHY (HSG)",
    "FISTULOGRAPHY",
    "RETROGRADE PYELOGRAPHY (RUCG)",
    "MICTURATING CYSTOURETHROGRAPHY (MCUG)",
    "SIALOGRAPHY",
    "MAMMOGRAPHY",
    "CT HEAD ROUTINE",
    "CT HEAD NEURO",
    "CT INNER EAR",
    "CT SINUS",
    "CT ORBIT",
    "CT DENTAL",
    "CT NECK",
    "CT SHOULDER",
    "CT LOWER EXTREMITIES",
    "CT CARDIAC STUDY",
    "CT VASCULAR",
    "CT CRANIAL ANGIOGRAPHY",
    "CT CAROTID ANGIOGRAPHY",
    "CT CAROTID DIGITAL SUBTRACTION",
    "CT THORACIC ANGIOGRAPHY",
    "UPPER GI ENDOSCOPY",
    "SIGMOIDOSCOPY/COLONOSCOPY",
    "PROCTOSCOPY",
    "REST ECG",
    "STRESS ECG",
    "AMBULATORY ECG (HOLTER)",
    "CT THORAX ROUTINE",
    "CT THORAX HR",
    "CT LUNG LOW DOSE",
    "CT CERVICAL SPINE",
    "CT THORACIC SPINE",
    "CT LUMBO-SACRAL SPINE",
    "CT PELVIS",
    "CT UPPER EXTREMITIES",
  ];

  function normalizeName(input: string) {
    return input
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "")
      .trim();
  }

  function generateCode(prefix: "LB" | "RD", name: string, index: number) {
    const initials = name
      .replace(/[^A-Za-z0-9 ]+/g, " ")
      .split(" ")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((chunk) => chunk[0].toUpperCase())
      .join("");
    return `${prefix}${String(index + 1).padStart(3, "0")}${initials || "TS"}`;
  }

  function inferLabCategory(name: string) {
    const n = name.toLowerCase();
    if (n.includes("culture") || n.includes("m/c/s") || n.includes("swab") || n.includes("stool") || n.includes("sputum") || n.includes("gram") || n.includes("mantoux")) {
      return "cat-micro";
    }
    if (n.includes("pcr") || n.includes("dna") || n.includes("rna") || n.includes("viral load") || n.includes("genotyping")) {
      return "cat-molecular";
    }
    if (n.includes("coombs") || n.includes("blood film") || n.includes("haemoglobin") || n.includes("fibrinogen") || n.includes("aptt") || n.includes("esr") || n.includes("cross match") || n.includes("blood group")) {
      return "cat-haematology";
    }
    if (n.includes("troponin") || n.includes("ck-mb") || n.includes("nt-probnp") || n.includes("cardiac")) {
      return "cat-cardiac";
    }
    if (n.includes("hiv") || n.includes("hepatitis") || n.includes("vdrl") || n.includes("brucella") || n.includes("hbs") || n.includes("hbe") || n.includes("hbcab") || n.includes("rf") || n.includes("ana")) {
      return "cat-serology";
    }
    if (n.includes("urine") || n.includes("urinalysis") || n.includes("microalbumin")) {
      return "cat-urine";
    }
    return "cat-chemistry";
  }

  const dedupedLab = Array.from(new Set(rawLabTests.map(normalizeName).filter(Boolean)));
  const dedupedRadiology = Array.from(new Set(rawRadiologyTests.map(normalizeName).filter(Boolean)));

  for (let i = 0; i < dedupedLab.length; i += 1) {
    const testName = dedupedLab[i];
    const code = generateCode("LB", testName, i);
    await seedTest({
      code,
      name: testName,
      type: TestType.LAB,
      department: Department.LABORATORY,
      categoryId: inferLabCategory(testName),
      price: 5000,
      turnaroundMinutes: 180,
      sampleType: "Lab Sample",
      description: "Added from expanded catalog list",
      fields: [
        { label: "Result", fieldKey: "result", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
        { label: "Reference Range", fieldKey: "reference_range", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
        { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
      ],
    });
  }

  for (let i = 0; i < dedupedRadiology.length; i += 1) {
    const testName = dedupedRadiology[i];
    const code = generateCode("RD", testName, i);
    await seedTest({
      code,
      name: testName,
      type: TestType.RADIOLOGY,
      department: Department.RADIOLOGY,
      categoryId: "cat-imaging",
      price: 12000,
      turnaroundMinutes: 120,
      description: "Added from expanded catalog list",
      fields: [
        { label: "Technique", fieldKey: "technique", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
        { label: "Findings", fieldKey: "findings", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
        { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 3 },
      ],
    });
  }

  console.log(`✅ Added/updated ${dedupedLab.length} expanded lab tests`);
  console.log(`✅ Added/updated ${dedupedRadiology.length} expanded radiology tests`);

  const testCount = await prisma.diagnosticTest.count({ where: { organizationId: orgId } });
  console.log(`\n✅ Seeding complete!`);
  console.log(`   Tests in database: ${testCount}`);
  console.log(`   Categories: ${categories.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
