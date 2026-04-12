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
      update: {
        categoryId: data.categoryId,
        name: data.name,
        type: data.type,
        department: data.department,
        price: data.price,
        turnaroundMinutes: data.turnaroundMinutes,
        sampleType: data.sampleType ?? null,
        description: data.description ?? null,
        isActive: true,
      },
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

  function makeRadiologyWorkflowFields() {
    return [
      { label: "Findings", fieldKey: "findings", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
      { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
      { label: "Notes", fieldKey: "notes", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
    ];
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
    fields: makeRadiologyWorkflowFields(),
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
    fields: makeRadiologyWorkflowFields(),
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
    fields: makeRadiologyWorkflowFields(),
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
    fields: makeRadiologyWorkflowFields(),
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
    fields: makeRadiologyWorkflowFields(),
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

  
  const LAB_FIELD_LIBRARY: Record<string, { label: string; fieldKey: string; fieldType: FieldType; unit?: string; normalMin?: number; normalMax?: number; options?: string; isRequired?: boolean; sortOrder: number; }[]> = {
  "ALKALINE PHOSPHATASE (ALP)": [
    { label: "Alkaline Phosphatase (ALP)", fieldKey: "alp", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 44, normalMax: 147, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "B10 CHEMISTRY PANEL HBA1C": [
    { label: "HbA1c", fieldKey: "hba1c", fieldType: FieldType.NUMBER, unit: "%", sortOrder: 1 },
    { label: "Interpretation", fieldKey: "interpretation", fieldType: FieldType.DROPDOWN, options: "Normal (<5.7%),Prediabetes (5.7-6.4%),Diabetes (>=6.5%)", isRequired: false, sortOrder: 2 },
    { label: "Estimated Average Glucose", fieldKey: "eag", fieldType: FieldType.NUMBER, unit: "mg/dL", isRequired: false, sortOrder: 3 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
  ],
  "LIPID PROFILE": [
    { label: "Cholesterol (Total)", fieldKey: "cholesterol_total", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMax: 200, sortOrder: 1 },
    { label: "Triglyceride", fieldKey: "triglyceride", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMax: 150, sortOrder: 2 },
    { label: "HDL-C", fieldKey: "hdl_c", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMin: 40, normalMax: 80, sortOrder: 3 },
    { label: "LDL-C", fieldKey: "ldl_c", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMax: 100, sortOrder: 4 },
    { label: "VLDL-C", fieldKey: "vldl_c", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMin: 5, normalMax: 30, isRequired: false, sortOrder: 5 },
    { label: "Risk Comment", fieldKey: "risk_comment", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "TRIGLYCERIDE": [
    { label: "Triglyceride", fieldKey: "triglyceride", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMax: 150, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CHOLESTEROL (TOTAL)": [
    { label: "Total Cholesterol", fieldKey: "cholesterol_total", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMax: 200, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HDL-C": [
    { label: "HDL-C", fieldKey: "hdl_c", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMin: 40, normalMax: 80, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "AST (SGOT)": [
    { label: "AST (SGOT)", fieldKey: "ast", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 8, normalMax: 48, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "ALT (SGPT)": [
    { label: "ALT (SGPT)", fieldKey: "alt", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 7, normalMax: 55, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "GGT": [
    { label: "GGT", fieldKey: "ggt", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 8, normalMax: 61, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "TOTAL BILIRUBIN": [
    { label: "Total Bilirubin", fieldKey: "total_bilirubin", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 2, normalMax: 21, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "DIRECT BILIRUBIN": [
    { label: "Direct Bilirubin", fieldKey: "direct_bilirubin", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 0, normalMax: 5, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "LDL-C": [
    { label: "LDL-C", fieldKey: "ldl_c", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMax: 100, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "PROTEIN (TOTAL)": [
    { label: "Total Protein", fieldKey: "total_protein", fieldType: FieldType.NUMBER, unit: "g/L", normalMin: 60, normalMax: 83, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "VLDL-C": [
    { label: "VLDL-C", fieldKey: "vldl_c", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMin: 5, normalMax: 30, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "ALBUMIN": [
    { label: "Albumin", fieldKey: "albumin", fieldType: FieldType.NUMBER, unit: "g/L", normalMin: 35, normalMax: 50, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "THYROID STIMULATING HORMONE (TSH)": [
    { label: "TSH", fieldKey: "tsh", fieldType: FieldType.NUMBER, unit: "µIU/mL", normalMin: 0.5, normalMax: 5.0, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "THYROXINE (T4 FREE)": [
    { label: "Free T4", fieldKey: "free_t4", fieldType: FieldType.NUMBER, unit: "ng/dL", normalMin: 0.8, normalMax: 1.9, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "THYROXINE (T4 TOTAL)": [
    { label: "Total T4", fieldKey: "total_t4", fieldType: FieldType.NUMBER, unit: "µg/dL", normalMin: 5.0, normalMax: 12.0, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "TRIIODOTHYRONINE (T3 TOTAL)": [
    { label: "Total T3", fieldKey: "total_t3", fieldType: FieldType.NUMBER, unit: "ng/dL", normalMin: 60, normalMax: 180, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "TRIIODOTHYRONINE (T3 FREE)": [
    { label: "Free T3", fieldKey: "free_t3", fieldType: FieldType.NUMBER, unit: "pg/dL", normalMin: 130, normalMax: 450, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "ELECTROLYTES": [
    { label: "Sodium", fieldKey: "sodium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 135, normalMax: 145, sortOrder: 1 },
    { label: "Potassium", fieldKey: "potassium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 3.5, normalMax: 5.2, sortOrder: 2 },
    { label: "Chloride", fieldKey: "chloride", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 98, normalMax: 106, sortOrder: 3 },
    { label: "Bicarbonate", fieldKey: "bicarbonate", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 22, normalMax: 28, sortOrder: 4 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
  ],
  "UREA": [
    { label: "Urea", fieldKey: "urea", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 2.1, normalMax: 8.0, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CREATININE": [
    { label: "Creatinine", fieldKey: "creatinine", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 53, normalMax: 115, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "BLOOD GASES": [
    { label: "pH", fieldKey: "ph", fieldType: FieldType.NUMBER, unit: "pH", normalMin: 7.35, normalMax: 7.45, sortOrder: 1 },
    { label: "pO2", fieldKey: "po2", fieldType: FieldType.NUMBER, unit: "mmHg", normalMin: 75, normalMax: 100, sortOrder: 2 },
    { label: "pCO2", fieldKey: "pco2", fieldType: FieldType.NUMBER, unit: "mmHg", normalMin: 35, normalMax: 45, sortOrder: 3 },
    { label: "HCO3-", fieldKey: "hco3", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 22, normalMax: 26, sortOrder: 4 },
    { label: "Base Excess", fieldKey: "base_excess", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: -2, normalMax: 2, isRequired: false, sortOrder: 5 },
    { label: "O2 Saturation", fieldKey: "o2_sat", fieldType: FieldType.NUMBER, unit: "%", normalMin: 95, normalMax: 100, isRequired: false, sortOrder: 6 },
    { label: "Lactate", fieldKey: "lactate", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 0.5, normalMax: 2.2, isRequired: false, sortOrder: 7 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 8 },
  ],
  "BLOOD PH": [
    { label: "Blood pH", fieldKey: "blood_ph", fieldType: FieldType.NUMBER, unit: "pH", normalMin: 7.35, normalMax: 7.45, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "OXYGEN (O2)": [
    { label: "pO2", fieldKey: "po2", fieldType: FieldType.NUMBER, unit: "mmHg", normalMin: 75, normalMax: 100, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CARBON DIOXIDE (CO2)": [
    { label: "pCO2", fieldKey: "pco2", fieldType: FieldType.NUMBER, unit: "mmHg", normalMin: 35, normalMax: 45, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CALCIUM (TOTAL)": [
    { label: "Total Calcium", fieldKey: "total_calcium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 2.12, normalMax: 2.62, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "IONIZED CALCIUM": [
    { label: "Ionized Calcium", fieldKey: "ionized_calcium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 1.12, normalMax: 1.32, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "LACTATE": [
    { label: "Lactate", fieldKey: "lactate", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 0.5, normalMax: 2.2, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "URIC ACID": [
    { label: "Uric Acid", fieldKey: "uric_acid", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 155, normalMax: 400, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "PREGNANCY TEST": [
    { label: "Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Indeterminate", sortOrder: 1 },
    { label: "Method", fieldKey: "method", fieldType: FieldType.DROPDOWN, options: "Urine hCG,Serum Qualitative hCG", isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "CRP": [
    { label: "CRP", fieldKey: "crp", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMin: 0, normalMax: 1.0, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CREATINE KINASE": [
    { label: "Creatine Kinase", fieldKey: "ck_total", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 22, normalMax: 198, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "PROCALCITONIN": [
    { label: "Procalcitonin", fieldKey: "procalcitonin", fieldType: FieldType.NUMBER, unit: "ng/mL", normalMin: 0, normalMax: 0.1, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "AMYLASE": [
    { label: "Amylase", fieldKey: "amylase", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 40, normalMax: 140, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "COMPREHENSIVE METABOLIC PANEL (CMP)": [
    { label: "Glucose", fieldKey: "glucose", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 3.9, normalMax: 5.6, sortOrder: 1 },
    { label: "Calcium", fieldKey: "calcium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 2.12, normalMax: 2.62, sortOrder: 2 },
    { label: "Sodium", fieldKey: "sodium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 135, normalMax: 145, sortOrder: 3 },
    { label: "Potassium", fieldKey: "potassium", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 3.7, normalMax: 5.2, sortOrder: 4 },
    { label: "Chloride", fieldKey: "chloride", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 98, normalMax: 106, sortOrder: 5 },
    { label: "Bicarbonate / CO2", fieldKey: "bicarbonate", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 22, normalMax: 28, sortOrder: 6 },
    { label: "Albumin", fieldKey: "albumin", fieldType: FieldType.NUMBER, unit: "g/L", normalMin: 35, normalMax: 50, sortOrder: 7 },
    { label: "Total Protein", fieldKey: "total_protein", fieldType: FieldType.NUMBER, unit: "g/L", normalMin: 60, normalMax: 83, sortOrder: 8 },
    { label: "ALP", fieldKey: "alp", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 40, normalMax: 129, sortOrder: 9 },
    { label: "ALT", fieldKey: "alt", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 7, normalMax: 55, sortOrder: 10 },
    { label: "AST", fieldKey: "ast", fieldType: FieldType.NUMBER, unit: "U/L", normalMin: 8, normalMax: 48, sortOrder: 11 },
    { label: "Total Bilirubin", fieldKey: "total_bilirubin", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 2, normalMax: 21, sortOrder: 12 },
    { label: "Urea", fieldKey: "urea", fieldType: FieldType.NUMBER, unit: "mmol/L", normalMin: 2.1, normalMax: 8.0, sortOrder: 13 },
    { label: "Creatinine", fieldKey: "creatinine", fieldType: FieldType.NUMBER, unit: "µmol/L", normalMin: 53, normalMax: 115, sortOrder: 14 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 15 },
  ],
  "PROTEIN ELECTROPHORESIS": [
    { label: "Albumin Fraction", fieldKey: "albumin_fraction", fieldType: FieldType.NUMBER, unit: "%", normalMin: 54, normalMax: 65, isRequired: false, sortOrder: 1 },
    { label: "Alpha 1", fieldKey: "alpha1", fieldType: FieldType.NUMBER, unit: "%", normalMin: 2, normalMax: 5, isRequired: false, sortOrder: 2 },
    { label: "Alpha 2", fieldKey: "alpha2", fieldType: FieldType.NUMBER, unit: "%", normalMin: 7, normalMax: 13, isRequired: false, sortOrder: 3 },
    { label: "Beta", fieldKey: "beta", fieldType: FieldType.NUMBER, unit: "%", normalMin: 8, normalMax: 14, isRequired: false, sortOrder: 4 },
    { label: "Gamma", fieldKey: "gamma", fieldType: FieldType.NUMBER, unit: "%", normalMin: 12, normalMax: 22, isRequired: false, sortOrder: 5 },
    { label: "Interpretation", fieldKey: "interpretation", fieldType: FieldType.TEXTAREA, sortOrder: 6 },
  ],
  "PROSTATE SPECIFIC ANTIGEN (PSA)": [
    { label: "Total PSA", fieldKey: "psa_total", fieldType: FieldType.NUMBER, unit: "ng/mL", normalMin: 0, normalMax: 4.0, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "PROSTATE SPECIFIC ANTIGEN (FREE)": [
    { label: "Free PSA", fieldKey: "psa_free", fieldType: FieldType.NUMBER, unit: "ng/mL", sortOrder: 1 },
    { label: "Free/Total PSA Ratio", fieldKey: "free_total_ratio", fieldType: FieldType.NUMBER, unit: "%", isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "CARCINOEMBRYONIC ANTIGEN (CEA)": [
    { label: "CEA", fieldKey: "cea", fieldType: FieldType.NUMBER, unit: "ng/mL", normalMin: 0, normalMax: 5.0, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "ALPHA-FETOPROTEIN (AFP)": [
    { label: "AFP", fieldKey: "afp", fieldType: FieldType.NUMBER, unit: "ng/mL", normalMin: 0, normalMax: 10.0, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CA-125 TEST": [
    { label: "CA-125", fieldKey: "ca125", fieldType: FieldType.NUMBER, unit: "U/mL", normalMin: 0, normalMax: 35, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CD4 T CELL COUNT": [
    { label: "CD4 Count", fieldKey: "cd4_count", fieldType: FieldType.NUMBER, unit: "cells/µL", normalMin: 500, normalMax: 1500, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CD4 T CELL PERCENTAGE": [
    { label: "CD4 Percentage", fieldKey: "cd4_percent", fieldType: FieldType.NUMBER, unit: "%", normalMin: 25, normalMax: 65, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CD8 T CELL COUNT": [
    { label: "CD8 Count", fieldKey: "cd8_count", fieldType: FieldType.NUMBER, unit: "cells/µL", normalMin: 150, normalMax: 1000, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HIV 1 & II CONFIRMATORY TEST": [
    { label: "Screening Assay", fieldKey: "screening_assay", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Confirmatory Assay", fieldKey: "confirmatory_assay", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Indeterminate", sortOrder: 2 },
    { label: "Final Interpretation", fieldKey: "interpretation", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Inconclusive", sortOrder: 3 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
  ],
  "HUMAN CHORIONIC GONADOTROPIN (B-HCG)": [
    { label: "Beta hCG", fieldKey: "beta_hcg", fieldType: FieldType.NUMBER, unit: "mIU/mL", normalMin: 0, normalMax: 5, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "PROGESTERONE": [
    { label: "Progesterone", fieldKey: "progesterone", fieldType: FieldType.NUMBER, unit: "ng/mL", sortOrder: 1 },
    { label: "Phase / Context", fieldKey: "phase", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "FOLLICLE STIMULATING HORMONE (FSH)": [
    { label: "FSH", fieldKey: "fsh", fieldType: FieldType.NUMBER, unit: "IU/L", normalMin: 1, normalMax: 9, sortOrder: 1 },
    { label: "Sex / Cycle Phase", fieldKey: "sex_phase", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "LUTEINIZING HORMONE (LH)": [
    { label: "LH", fieldKey: "lh", fieldType: FieldType.NUMBER, unit: "IU/L", normalMin: 1, normalMax: 9, sortOrder: 1 },
    { label: "Sex / Cycle Phase", fieldKey: "sex_phase", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "PROLACTIN": [
    { label: "Prolactin", fieldKey: "prolactin", fieldType: FieldType.NUMBER, unit: "mIU/L", normalMin: 41, normalMax: 520, sortOrder: 1 },
    { label: "Sex", fieldKey: "sex", fieldType: FieldType.DROPDOWN, options: "Male,Female", isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "OESTROGEN (E2)": [
    { label: "Estradiol (E2)", fieldKey: "estradiol", fieldType: FieldType.NUMBER, unit: "pmol/L", sortOrder: 1 },
    { label: "Cycle Phase / Sex", fieldKey: "phase", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "VITAMIN B12": [
    { label: "Vitamin B12", fieldKey: "vitamin_b12", fieldType: FieldType.NUMBER, unit: "pg/mL", normalMin: 160, normalMax: 950, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "VITAMIN D": [
    { label: "Vitamin D (25-OH)", fieldKey: "vitamin_d", fieldType: FieldType.NUMBER, unit: "ng/mL", normalMin: 30, normalMax: 100, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "FERRITIN": [
    { label: "Ferritin", fieldKey: "ferritin", fieldType: FieldType.NUMBER, unit: "ng/mL", sortOrder: 1 },
    { label: "Sex", fieldKey: "sex", fieldType: FieldType.DROPDOWN, options: "Male,Female", isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "PARATHYROID HORMONE (PTH)": [
    { label: "PTH", fieldKey: "pth", fieldType: FieldType.NUMBER, unit: "pg/mL", normalMin: 10, normalMax: 65, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "DEHYDROEPIANDROSTERONE SULFATE (DHEA-S)": [
    { label: "DHEA-S", fieldKey: "dhea_s", fieldType: FieldType.NUMBER, unit: "µg/dL", sortOrder: 1 },
    { label: "Sex / Age Group", fieldKey: "sex_age_group", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "CORTISOL": [
    { label: "Cortisol", fieldKey: "cortisol", fieldType: FieldType.NUMBER, unit: "nmol/L", sortOrder: 1 },
    { label: "Collection Time", fieldKey: "collection_time", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "TESTOSTERONE": [
    { label: "Total Testosterone", fieldKey: "testosterone", fieldType: FieldType.NUMBER, unit: "ng/dL", sortOrder: 1 },
    { label: "Sex", fieldKey: "sex", fieldType: FieldType.DROPDOWN, options: "Male,Female", isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "MICROALBUMIN": [
    { label: "Urine Albumin", fieldKey: "microalbumin", fieldType: FieldType.NUMBER, unit: "mg/L", normalMin: 0, normalMax: 20, sortOrder: 1 },
    { label: "Albumin/Creatinine Ratio", fieldKey: "acr", fieldType: FieldType.NUMBER, unit: "mg/g", normalMin: 0, normalMax: 30, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "ADRENOCORTICOTROPIC HORMONE (ACTH)": [
    { label: "ACTH", fieldKey: "acth", fieldType: FieldType.NUMBER, unit: "pg/mL", normalMin: 10, normalMax: 60, sortOrder: 1 },
    { label: "Collection Time", fieldKey: "collection_time", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "HBsAg-QUANTITATIVE": [
    { label: "HBsAg Quantitative", fieldKey: "hbsag_quant", fieldType: FieldType.NUMBER, unit: "IU/mL", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HUMAN GROWTH HORMONE": [
    { label: "Growth Hormone", fieldKey: "growth_hormone", fieldType: FieldType.NUMBER, unit: "ng/mL", sortOrder: 1 },
    { label: "Interpretation Note", fieldKey: "interpretation_note", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "ANTI NUCLEAR ANTIBODY (ANA)": [
    { label: "ANA Result", fieldKey: "ana_result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Borderline", sortOrder: 1 },
    { label: "Titre", fieldKey: "titre", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Pattern", fieldKey: "pattern", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 3 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
  ],
  "DOUBLE STRANDED DNA TEST (ds-DNA)": [
    { label: "dsDNA", fieldKey: "dsdna", fieldType: FieldType.NUMBER, unit: "IU/mL", normalMin: 0, normalMax: 30, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "BRAIN NATRIURETIC PEPTIDE (NT-proBNP)": [
    { label: "NT-proBNP", fieldKey: "ntprobnp", fieldType: FieldType.NUMBER, unit: "pg/mL", normalMin: 0, normalMax: 300, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CK-MB": [
    { label: "CK-MB", fieldKey: "ck_mb", fieldType: FieldType.NUMBER, unit: "ng/mL", normalMin: 0, normalMax: 5, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "TROPONIN T": [
    { label: "Troponin T", fieldKey: "troponin_t", fieldType: FieldType.NUMBER, unit: "µg/L", normalMin: 0, normalMax: 0.1, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "TROPONIN I": [
    { label: "Troponin I", fieldKey: "troponin_i", fieldType: FieldType.NUMBER, unit: "ng/L", normalMin: 0, normalMax: 45, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBV 5 PANEL TEST": [
    { label: "HBsAg", fieldKey: "hbsag", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "HBsAb", fieldKey: "hbsab", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 2 },
    { label: "HBeAg", fieldKey: "hbeag", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 3 },
    { label: "HBeAb", fieldKey: "hbeab", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 4 },
    { label: "HBcAb", fieldKey: "hbcab", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "HBsAb-QUANTITATIVE": [
    { label: "HBsAb Quantitative", fieldKey: "hbsab_quant", fieldType: FieldType.NUMBER, unit: "mIU/mL", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBeAg-QUANTITATIVE": [
    { label: "HBeAg Quantitative", fieldKey: "hbeag_quant", fieldType: FieldType.NUMBER, unit: "PEI U/mL", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBeAb-QUANTITATIVE": [
    { label: "HBeAb Quantitative", fieldKey: "hbeab_quant", fieldType: FieldType.NUMBER, unit: "PEI U/mL", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBcAb-QUANTITATIVE": [
    { label: "HBcAb Quantitative", fieldKey: "hbcab_quant", fieldType: FieldType.NUMBER, unit: "PEI U/mL", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBV DNA PANEL": [
    { label: "HBV DNA Viral Load", fieldKey: "hbv_dna", fieldType: FieldType.NUMBER, unit: "IU/mL", sortOrder: 1 },
    { label: "Log10 Viral Load", fieldKey: "hbv_dna_log", fieldType: FieldType.NUMBER, unit: "log10 IU/mL", isRequired: false, sortOrder: 2 },
    { label: "Interpretation", fieldKey: "interpretation", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "HBsAg-QUALITATIVE": [
    { label: "HBsAg", fieldKey: "hbsag", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBsAb-QUALITATIVE": [
    { label: "HBsAb", fieldKey: "hbsab", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBeAg-QUALITATIVE": [
    { label: "HBeAg", fieldKey: "hbeag", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBeAb-QUALITATIVE": [
    { label: "HBeAb", fieldKey: "hbeab", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HBcAb-QUALITATIVE": [
    { label: "HBcAb", fieldKey: "hbcab", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "SEMEN ANALYSIS": [
    { label: "Volume", fieldKey: "volume", fieldType: FieldType.NUMBER, unit: "mL", normalMin: 1.4, sortOrder: 1 },
    { label: "pH", fieldKey: "ph", fieldType: FieldType.NUMBER, unit: "pH", normalMin: 7.2, normalMax: 8.0, sortOrder: 2 },
    { label: "Sperm Concentration", fieldKey: "sperm_concentration", fieldType: FieldType.NUMBER, unit: "million/mL", normalMin: 15, sortOrder: 3 },
    { label: "Total Motility", fieldKey: "motility", fieldType: FieldType.NUMBER, unit: "%", normalMin: 40, normalMax: 100, sortOrder: 4 },
    { label: "Progressive Motility", fieldKey: "progressive_motility", fieldType: FieldType.NUMBER, unit: "%", normalMin: 32, normalMax: 100, isRequired: false, sortOrder: 5 },
    { label: "Morphology", fieldKey: "morphology", fieldType: FieldType.NUMBER, unit: "%", normalMin: 4, normalMax: 100, isRequired: false, sortOrder: 6 },
    { label: "Liquefaction Time", fieldKey: "liquefaction_time", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 7 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 8 },
  ],
  "BLOOD GROUP": [
    { label: "ABO Group", fieldKey: "abo_group", fieldType: FieldType.DROPDOWN, options: "A,B,AB,O", sortOrder: 1 },
    { label: "Rh Type", fieldKey: "rh_type", fieldType: FieldType.DROPDOWN, options: "Positive,Negative", sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "GENOTYPE": [
    { label: "Genotype", fieldKey: "genotype", fieldType: FieldType.DROPDOWN, options: "AA,AS,AC,SS,SC,CC", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "DIRECT COOMBS TEST": [
    { label: "Direct Coombs Result", fieldKey: "direct_coombs", fieldType: FieldType.DROPDOWN, options: "Positive,Negative", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "INDIRECT COOMBS TEST": [
    { label: "Indirect Coombs Result", fieldKey: "indirect_coombs", fieldType: FieldType.DROPDOWN, options: "Positive,Negative", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CROSS MATCHING": [
    { label: "Donor Unit Number", fieldKey: "donor_unit", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 1 },
    { label: "Crossmatch Result", fieldKey: "crossmatch_result", fieldType: FieldType.DROPDOWN, options: "Compatible,Incompatible", sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "HB ELECTROPHORESIS": [
    { label: "HbA", fieldKey: "hb_a", fieldType: FieldType.NUMBER, unit: "%", normalMin: 95, normalMax: 99, isRequired: false, sortOrder: 1 },
    { label: "HbA2", fieldKey: "hb_a2", fieldType: FieldType.NUMBER, unit: "%", normalMin: 2, normalMax: 3.5, isRequired: false, sortOrder: 2 },
    { label: "HbF", fieldKey: "hb_f", fieldType: FieldType.NUMBER, unit: "%", normalMin: 0, normalMax: 1, isRequired: false, sortOrder: 3 },
    { label: "Pattern", fieldKey: "pattern", fieldType: FieldType.TEXTAREA, sortOrder: 4 },
  ],
  "GENOTYPING (CONFIRMATORY)": [
    { label: "Confirmed Genotype", fieldKey: "confirmed_genotype", fieldType: FieldType.DROPDOWN, options: "AA,AS,AC,SS,SC,CC", sortOrder: 1 },
    { label: "Method", fieldKey: "method", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "PROTHROMBIN TIME": [
    { label: "PT", fieldKey: "pt", fieldType: FieldType.NUMBER, unit: "seconds", normalMin: 11, normalMax: 13.5, sortOrder: 1 },
    { label: "INR", fieldKey: "inr", fieldType: FieldType.NUMBER, unit: "ratio", normalMin: 0.8, normalMax: 1.1, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "APTT": [
    { label: "aPTT", fieldKey: "aptt", fieldType: FieldType.NUMBER, unit: "seconds", normalMin: 25, normalMax: 35, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "FIBRINOGEN": [
    { label: "Fibrinogen", fieldKey: "fibrinogen", fieldType: FieldType.NUMBER, unit: "mg/dL", normalMin: 200, normalMax: 400, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "ESR": [
    { label: "ESR", fieldKey: "esr", fieldType: FieldType.NUMBER, unit: "mm/hr", normalMin: 0, normalMax: 20, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HAEMOGLOBIN (HB)": [
    { label: "Haemoglobin", fieldKey: "haemoglobin", fieldType: FieldType.NUMBER, unit: "g/dL", normalMin: 12, normalMax: 17, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "DNA PATERNITY TEST": [
    { label: "Result Summary", fieldKey: "result_summary", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Probability of Paternity", fieldKey: "probability", fieldType: FieldType.NUMBER, unit: "%", isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "HBV DNA VIRAL LOAD": [
    { label: "HBV DNA Viral Load", fieldKey: "hbv_dna_viral_load", fieldType: FieldType.NUMBER, unit: "IU/mL", sortOrder: 1 },
    { label: "Log10 Viral Load", fieldKey: "hbv_dna_log", fieldType: FieldType.NUMBER, unit: "log10 IU/mL", isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "HBV RNA BY RT-PCR": [
    { label: "HBV RNA", fieldKey: "hbv_rna", fieldType: FieldType.NUMBER, unit: "copies/mL", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HCV RNA VIRAL LOAD": [
    { label: "HCV RNA Viral Load", fieldKey: "hcv_rna_viral_load", fieldType: FieldType.NUMBER, unit: "IU/mL", sortOrder: 1 },
    { label: "Log10 Viral Load", fieldKey: "hcv_rna_log", fieldType: FieldType.NUMBER, unit: "log10 IU/mL", isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "HCV GENOTYPING": [
    { label: "HCV Genotype", fieldKey: "hcv_genotype", fieldType: FieldType.TEXT, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "TUBERCULOSIS ANTIGEN TEST": [
    { label: "TB Antigen Result", fieldKey: "tb_antigen_result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Indeterminate", sortOrder: 1 },
    { label: "Method", fieldKey: "method", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "HBV QUALITATIVE (CONFIRMATORY TEST)": [
    { label: "HBV Confirmatory Result", fieldKey: "hbv_confirm_result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Indeterminate", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HCV QUALITATIVE (CONFIRMATORY TEST)": [
    { label: "HCV Confirmatory Result", fieldKey: "hcv_confirm_result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Indeterminate", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HEPATITIS B SCREENING": [
    { label: "HBsAg Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HEPATITIS C SCREENING": [
    { label: "Anti-HCV Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "CHLAMYDIA": [
    { label: "Chlamydia Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Inconclusive", sortOrder: 1 },
    { label: "Method", fieldKey: "method", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "VDRL": [
    { label: "VDRL Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Titre", fieldKey: "titre", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "BRUCELLA SCREENING": [
    { label: "Brucella Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Inconclusive", sortOrder: 1 },
    { label: "Titre", fieldKey: "titre", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "URINE M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "STOOL M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "SPUTUM M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "BLOOD CULTURE/SENSITIVITY": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "HIGH VAGINAL SWAB (HVS) M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "ENDOCERVICAL SWAB (ECS) M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "URETHRAL SWAB M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "SEMEN M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "SKIN/NAIL SCRAPING M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "OTHER SWABS/FLUID M/C/S": [
    { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
    { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
    { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
  ],
  "GRAM STAINING": [
    { label: "Gram Stain Result", fieldKey: "gram_stain_result", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "H. PYLORI SCREENING": [
    { label: "H. pylori Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Inconclusive", sortOrder: 1 },
    { label: "Method", fieldKey: "method", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "ASO TITRE": [
    { label: "ASO Titre", fieldKey: "aso_titre", fieldType: FieldType.NUMBER, unit: "IU/mL", normalMin: 0, normalMax: 200, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "RHEUMATOID FACTOR": [
    { label: "Rheumatoid Factor", fieldKey: "rf", fieldType: FieldType.NUMBER, unit: "kIU/L", normalMin: 0, normalMax: 20, sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "HEPATITIS A SCREENING": [
    { label: "HAV Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "BLOOD FILM": [
    { label: "Film Findings", fieldKey: "film_findings", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "MALARIA PARASITES (MP)": [
    { label: "Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative", sortOrder: 1 },
    { label: "Species", fieldKey: "species", fieldType: FieldType.DROPDOWN, options: "Plasmodium falciparum,Plasmodium vivax,Plasmodium malariae,Mixed,Not Applicable", isRequired: false, sortOrder: 2 },
    { label: "Parasitaemia", fieldKey: "parasitaemia", fieldType: FieldType.DROPDOWN, options: "+,++,+++,++++,Not Applicable", isRequired: false, sortOrder: 3 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
  ],
  "HIV SCREENING": [
    { label: "Determine Result", fieldKey: "determine", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive", sortOrder: 1 },
    { label: "Unigold Result", fieldKey: "unigold", fieldType: FieldType.DROPDOWN, options: "Reactive,Non-Reactive,Not Done", isRequired: false, sortOrder: 2 },
    { label: "Final Interpretation", fieldKey: "interpretation", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Inconclusive", sortOrder: 3 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
  ],
  "MANTOUX TEST": [
    { label: "Induration Size", fieldKey: "induration", fieldType: FieldType.NUMBER, unit: "mm", normalMin: 0, sortOrder: 1 },
    { label: "Interpretation", fieldKey: "interpretation", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
  ],
  "SKIN SCRAPING ANALYSIS": [
    { label: "Microscopy Findings", fieldKey: "microscopy_findings", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Organism Seen", fieldKey: "organism_seen", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
  "SPUTUM AFB (X2)": [
    { label: "AFB Smear 1", fieldKey: "afb1", fieldType: FieldType.DROPDOWN, options: "Negative,Scanty,1+,2+,3+", sortOrder: 1 },
    { label: "AFB Smear 2", fieldKey: "afb2", fieldType: FieldType.DROPDOWN, options: "Negative,Scanty,1+,2+,3+", sortOrder: 2 },
    { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
  ],
};

  const RADIOLOGY_FIELD_LIBRARY: Record<string, { label: string; fieldKey: string; fieldType: FieldType; unit?: string; normalMin?: number; normalMax?: number; options?: string; isRequired?: boolean; sortOrder: number; }[]> = {
  "ABDOMINAL SCAN": [
    { label: "Liver", fieldKey: "liver", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Gallbladder", fieldKey: "gallbladder", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Spleen", fieldKey: "spleen", fieldType: FieldType.TEXTAREA, sortOrder: 3 },
    { label: "Pancreas", fieldKey: "pancreas", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Kidneys", fieldKey: "kidneys", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
    { label: "Urinary Bladder", fieldKey: "bladder", fieldType: FieldType.TEXTAREA, sortOrder: 6 },
    { label: "Free Fluid", fieldKey: "free_fluid", fieldType: FieldType.DROPDOWN, options: "None,Minimal,Moderate,Gross", isRequired: false, sortOrder: 7 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 8 },
  ],
  "PELVIC SCAN": [
    { label: "Uterus", fieldKey: "uterus", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Ovaries", fieldKey: "ovaries", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Endometrium", fieldKey: "endometrium", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
    { label: "Pouch of Douglas", fieldKey: "pod", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
  ],
  "OBSTETRIC/FETAL ULTRASOUND": [
    { label: "Gestational Age", fieldKey: "gestational_age", fieldType: FieldType.TEXT, sortOrder: 1 },
    { label: "Fetal Number", fieldKey: "fetal_number", fieldType: FieldType.DROPDOWN, options: "Singleton,Twins,Triplets", sortOrder: 2 },
    { label: "Presentation", fieldKey: "presentation", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 3 },
    { label: "Fetal Heart Rate", fieldKey: "fhr", fieldType: FieldType.NUMBER, unit: "bpm", normalMin: 110, normalMax: 160, sortOrder: 4 },
    { label: "Placenta", fieldKey: "placenta", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Liquor", fieldKey: "liquor", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 6 },
    { label: "Biometry", fieldKey: "biometry", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 7 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 8 },
  ],
  "BREAST SCAN": [
    { label: "Right Breast", fieldKey: "right_breast", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Left Breast", fieldKey: "left_breast", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Axillae", fieldKey: "axillae", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 4 },
  ],
  "OCCULAR SCAN": [
    { label: "Right Eye", fieldKey: "right_eye", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Left Eye", fieldKey: "left_eye", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 3 },
  ],
  "TRANSRECTAL/PROSTATE SCAN": [
    { label: "Prostate", fieldKey: "prostate", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Seminal Vesicles", fieldKey: "seminal_vesicles", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    { label: "Bladder", fieldKey: "bladder", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 4 },
  ],
  "FOLLICULOMETRY": [
    { label: "Day of Cycle", fieldKey: "day_of_cycle", fieldType: FieldType.TEXT, sortOrder: 1 },
    { label: "Right Ovary", fieldKey: "right_ovary", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Left Ovary", fieldKey: "left_ovary", fieldType: FieldType.TEXTAREA, sortOrder: 3 },
    { label: "Endometrium", fieldKey: "endometrium", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
  ],
  "SONO-HSG": [
    { label: "Uterus", fieldKey: "uterus", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Right Tube", fieldKey: "right_tube", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Left Tube", fieldKey: "left_tube", fieldType: FieldType.TEXTAREA, sortOrder: 3 },
    { label: "Spillage", fieldKey: "spillage", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
  ],
  "ECHOCARDIOGRAM": [
    { label: "Cardiac Chambers", fieldKey: "chambers", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Valves", fieldKey: "valves", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Ejection Fraction", fieldKey: "ejection_fraction", fieldType: FieldType.NUMBER, unit: "%", normalMin: 50, normalMax: 70, isRequired: false, sortOrder: 3 },
    { label: "Pericardium", fieldKey: "pericardium", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
  ],
  "DOPPLER STUDY": [
    { label: "Vessel / Region", fieldKey: "vessel_region", fieldType: FieldType.TEXT, sortOrder: 1 },
    { label: "Spectral / Flow Findings", fieldKey: "flow_findings", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 3 },
  ],
  "MAMMOGRAPHY": [
    { label: "Breast Density", fieldKey: "breast_density", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 1 },
    { label: "Right Breast", fieldKey: "right_breast", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Left Breast", fieldKey: "left_breast", fieldType: FieldType.TEXTAREA, sortOrder: 3 },
    { label: "BI-RADS", fieldKey: "birads", fieldType: FieldType.DROPDOWN, options: "0,1,2,3,4,5,6", isRequired: false, sortOrder: 4 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
  ],
  "REST ECG": [
    { label: "Rhythm", fieldKey: "rhythm", fieldType: FieldType.TEXT, sortOrder: 1 },
    { label: "Rate", fieldKey: "rate", fieldType: FieldType.NUMBER, unit: "bpm", normalMin: 60, normalMax: 100, sortOrder: 2 },
    { label: "Axis", fieldKey: "axis", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 3 },
    { label: "Intervals", fieldKey: "intervals", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "ST-T Changes", fieldKey: "st_t_changes", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 6 },
  ],
  "STRESS ECG": [
    { label: "Protocol", fieldKey: "protocol", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 1 },
    { label: "Rhythm", fieldKey: "rhythm", fieldType: FieldType.TEXT, sortOrder: 2 },
    { label: "Max Heart Rate", fieldKey: "max_heart_rate", fieldType: FieldType.NUMBER, unit: "bpm", isRequired: false, sortOrder: 3 },
    { label: "ST Changes", fieldKey: "st_changes", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Symptoms", fieldKey: "symptoms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 6 },
  ],
  "AMBULATORY ECG (HOLTER)": [
    { label: "Duration", fieldKey: "duration", fieldType: FieldType.TEXT, sortOrder: 1 },
    { label: "Underlying Rhythm", fieldKey: "underlying_rhythm", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Arrhythmias", fieldKey: "arrhythmias", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
    { label: "Heart Rate Summary", fieldKey: "heart_rate_summary", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 5 },
  ],
  "UPPER GI ENDOSCOPY": [
    { label: "Esophagus", fieldKey: "esophagus", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Stomach", fieldKey: "stomach", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Duodenum", fieldKey: "duodenum", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 4 },
  ],
  "SIGMOIDOSCOPY/COLONOSCOPY": [
    { label: "Preparation", fieldKey: "preparation", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 1 },
    { label: "Findings", fieldKey: "findings", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
    { label: "Biopsy Taken", fieldKey: "biopsy_taken", fieldType: FieldType.DROPDOWN, options: "Yes,No", isRequired: false, sortOrder: 3 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 4 },
  ],
  "PROCTOSCOPY": [
    { label: "Findings", fieldKey: "findings", fieldType: FieldType.TEXTAREA, sortOrder: 1 },
    { label: "Impression", fieldKey: "impression", fieldType: FieldType.TEXTAREA, sortOrder: 2 },
  ],
};

  function inferMainUnit(testName: string) {
    const mapped = LAB_FIELD_LIBRARY[testName];
    if (mapped && mapped[0]?.unit) return mapped[0].unit ?? "";
    const n = testName.toLowerCase();
    if (n.includes("viral load")) return "IU/mL";
    if (n.includes("dna") || n.includes("rna")) return "copies/mL";
    if (n.includes("culture") || n.includes("screening") || n.includes("analysis")) return "";
    return "";
  }

  function buildLabMainFields(testName: string) {
    const mapped = LAB_FIELD_LIBRARY[testName];
    if (mapped) return mapped;

    if (testName.includes("M/C/S") || testName.includes("CULTURE")) {
      return [
        { label: "Macroscopy", fieldKey: "macroscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 1 },
        { label: "Microscopy", fieldKey: "microscopy", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
        { label: "Culture Result", fieldKey: "culture_result", fieldType: FieldType.DROPDOWN, options: "No Growth,Growth Present,Mixed Growth", sortOrder: 3 },
        { label: "Isolated Organism(s)", fieldKey: "organisms", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 4 },
        { label: "Sensitivity Pattern", fieldKey: "sensitivity", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 5 },
        { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 6 },
      ];
    }

    const n = testName.toLowerCase();
    if (n.includes("screening") || n.includes("qualitative") || n.includes("confirmatory")) {
      return [
        { label: "Result", fieldKey: "result", fieldType: FieldType.DROPDOWN, options: "Positive,Negative,Inconclusive", sortOrder: 1 },
        { label: "Method", fieldKey: "method", fieldType: FieldType.TEXT, isRequired: false, sortOrder: 2 },
        { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 3 },
      ];
    }

    const key = testName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);

    return [
      { label: testName, fieldKey: key || "result_value", fieldType: FieldType.TEXT, sortOrder: 1 },
      { label: "Comments", fieldKey: "comments", fieldType: FieldType.TEXTAREA, isRequired: false, sortOrder: 2 },
    ];
  }

  function buildRadiologyMainFields(testName: string) {
    void RADIOLOGY_FIELD_LIBRARY[testName];
    return makeRadiologyWorkflowFields();
  }


  const existingLabNames = new Set(
    (
      await prisma.diagnosticTest.findMany({
        where: { organizationId: orgId, type: TestType.LAB },
        select: { name: true },
      })
    ).map((test) => normalizeName(test.name).toUpperCase())
  );

  const existingRadiologyNames = new Set(
    (
      await prisma.diagnosticTest.findMany({
        where: { organizationId: orgId, type: TestType.RADIOLOGY },
        select: { name: true },
      })
    ).map((test) => normalizeName(test.name).toUpperCase())
  );

  const dedupedLab = Array.from(
    new Set(rawLabTests.map(normalizeName).filter(Boolean))
  ).filter((name) => !existingLabNames.has(name.toUpperCase()));

  const dedupedRadiology = Array.from(
    new Set(rawRadiologyTests.map(normalizeName).filter(Boolean))
  ).filter((name) => !existingRadiologyNames.has(name.toUpperCase()));

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
      fields: buildLabMainFields(testName),
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
      fields: buildRadiologyMainFields(testName),
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
