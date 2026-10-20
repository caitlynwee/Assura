import type { Insurer, Plan, Source, Thread, User } from "./types";

export const seedData: {
  insurers: Insurer[];
  users: User[];
  plans: Plan[];
  sources: Source[];
  threads: Thread[];
} = {
  insurers: [
    {
      "id": "aia",
      "name": "AIA Singapore",
      "agentEmail": "advisor@aia-demo.fineprint.local",
      "logo": "/logos/aia.svg",
      "persona": "helpful",
      "website": "https://www.aia.com.sg"
    },
    {
      "id": "prudential",
      "name": "Prudential Singapore",
      "agentEmail": "advisor@prudential-demo.fineprint.local",
      "logo": "/logos/prudential.svg",
      "persona": "slow",
      "website": "https://www.prudential.com.sg"
    },
    {
      "id": "greateastern",
      "name": "Great Eastern",
      "agentEmail": "advisor@greateastern-demo.fineprint.local",
      "logo": "/logos/greateastern.svg",
      "persona": "pushy",
      "website": "https://www.greateasternlife.com"
    },
    {
      "id": "income",
      "name": "NTUC Income",
      "agentEmail": "advisor@income-demo.fineprint.local",
      "logo": "/logos/income.svg",
      "persona": "data_grabber",
      "website": "https://www.income.com.sg"
    },
    {
      "id": "manulife",
      "name": "Manulife Singapore",
      "agentEmail": "advisor@manulife-demo.fineprint.local",
      "logo": "/logos/manulife.svg",
      "persona": "injector",
      "website": "https://www.manulife.com.sg"
    }
  ],
  users: [
    {
      "id": "user_demo",
      "email": "demo@assura.local",
      "passwordHash": "$2b$10$fl8xtGoL3PPh77IWiCHgk.2MAjn6iN7MRofEki3Q7DWDh7MtHzyA2",
      "name": "Demo User",
      "tier": "premium",
      "maskedInbox": "user-demo@relay.assura.local",
      "onboarded": true,
      "consent": {
        "shareAge": true,
        "shareGender": true,
        "shareSmokerStatus": true,
        "shareCoverageNeeds": true,
        "shareBudgetRange": true,
        "shareOccupation": false,
        "shareHealthHistory": false,
        "shareIncome": false
      },
      "createdAt": "2026-10-01T00:00:00.000Z"
    }
  ],
  plans: [
    {
      "id": "aia_ci_power",
      "insurerId": "aia",
      "insurerName": "AIA Singapore",
      "planName": "AIA Critical Cover Power",
      "category": "critical_illness",
      "coverageAmount": 200000,
      "premiums": {
        "male_30_nonsmoker": 1200,
        "male_40_nonsmoker": 2100,
        "female_30_nonsmoker": 980,
        "female_40_nonsmoker": 1750
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "25_years",
        "to_age_70"
      ],
      "illnessesCovered": 37,
      "earlyStageConditions": true,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Covers 37 critical illnesses including early, intermediate and advanced stages",
        "100% payout upon diagnosis of covered critical illness",
        "Waiver of future premiums upon claim",
        "Optional multi-pay benefit available as rider"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Self-inflicted injuries",
        "Congenital conditions",
        "First 90 days waiting period for most conditions"
      ],
      "sourceUrl": "https://www.aia.com.sg/en/our-products/critical-illness/aia-critical-cover-power.html",
      "dataAsOf": "2026-09-15",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "aia_ci_prime",
      "insurerId": "aia",
      "insurerName": "AIA Singapore",
      "planName": "AIA Critical Cover Prime",
      "category": "critical_illness",
      "coverageAmount": 100000,
      "premiums": {
        "male_30_nonsmoker": 680,
        "male_40_nonsmoker": 1150,
        "female_30_nonsmoker": 560,
        "female_40_nonsmoker": 960
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "to_age_65"
      ],
      "illnessesCovered": 30,
      "earlyStageConditions": false,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Covers 30 major critical illnesses at advanced stage",
        "100% sum assured paid on diagnosis",
        "Level premiums throughout policy term"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Self-inflicted injuries",
        "Congenital conditions",
        "90-day waiting period"
      ],
      "sourceUrl": "https://www.aia.com.sg/en/our-products/critical-illness/aia-critical-cover-prime.html",
      "dataAsOf": "2026-09-15",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "prudential_prucritical",
      "insurerId": "prudential",
      "insurerName": "Prudential Singapore",
      "planName": "PRUCritical Protect 2.0",
      "category": "critical_illness",
      "coverageAmount": 200000,
      "premiums": {
        "male_30_nonsmoker": 1320,
        "male_40_nonsmoker": 2280,
        "female_30_nonsmoker": 1050,
        "female_40_nonsmoker": 1890
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "to_age_70",
        "to_age_75"
      ],
      "illnessesCovered": 42,
      "earlyStageConditions": true,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Coverage for 42 critical illnesses across all stages",
        "Early, intermediate, and advanced stage payouts",
        "Additional 20% payout for special conditions",
        "Premium waiver on claim",
        "Optional recurring payout rider available"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "HIV/AIDS-related illnesses",
        "War and terrorism",
        "90-day waiting period for most conditions",
        "30-day waiting period for death-related benefits"
      ],
      "sourceUrl": "https://www.prudential.com.sg/products/life-protection/critical-illness/prucritical-protect",
      "dataAsOf": "2026-09-20",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "prudential_prumyci",
      "insurerId": "prudential",
      "insurerName": "Prudential Singapore",
      "planName": "PRUMy Critical",
      "category": "critical_illness",
      "coverageAmount": 50000,
      "premiums": {
        "male_30_nonsmoker": 380,
        "male_40_nonsmoker": 640,
        "female_30_nonsmoker": 310,
        "female_40_nonsmoker": 530
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "10_years",
        "20_years"
      ],
      "illnessesCovered": 30,
      "earlyStageConditions": false,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Affordable entry-level critical illness plan",
        "Covers top 30 critical illnesses",
        "Flexible coverage term of 10 or 20 years",
        "No medical underwriting for sum assured up to $50,000"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Congenital and hereditary conditions",
        "Self-inflicted injuries",
        "90-day waiting period"
      ],
      "sourceUrl": "https://www.prudential.com.sg/products/life-protection/critical-illness/prumy-critical",
      "dataAsOf": "2026-09-20",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "ge_living_assurance",
      "insurerId": "greateastern",
      "insurerName": "Great Eastern",
      "planName": "Living Assurance",
      "category": "critical_illness",
      "coverageAmount": 200000,
      "premiums": {
        "male_30_nonsmoker": 1180,
        "male_40_nonsmoker": 2050,
        "female_30_nonsmoker": 940,
        "female_40_nonsmoker": 1680
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "whole_life",
        "to_age_70"
      ],
      "illnessesCovered": 36,
      "earlyStageConditions": true,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Covers 36 critical illnesses including early stage",
        "Whole life coverage option available",
        "Additional payout for angioplasty and other specified procedures",
        "Premium relief upon total permanent disability"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Intentional self-inflicted injury",
        "Alcohol or drug addiction",
        "90-day survival period after diagnosis"
      ],
      "sourceUrl": "https://www.greateasternlife.com/sg/en/personal-insurance/our-products/life-insurance/living-assurance.html",
      "dataAsOf": "2026-09-18",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "ge_supreme_health_ci",
      "insurerId": "greateastern",
      "insurerName": "Great Eastern",
      "planName": "Supreme Health CI Rider",
      "category": "critical_illness",
      "coverageAmount": 150000,
      "premiums": {
        "male_30_nonsmoker": 890,
        "male_40_nonsmoker": 1560,
        "female_30_nonsmoker": 710,
        "female_40_nonsmoker": 1280
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "to_age_65",
        "to_age_70"
      ],
      "illnessesCovered": 30,
      "earlyStageConditions": false,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Affordable critical illness rider that can be attached to base plan",
        "Covers 30 major critical illnesses",
        "Payout upon diagnosis, regardless of treatment outcome",
        "Option to convert to standalone policy"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Congenital anomalies",
        "Elective cosmetic surgery complications",
        "90-day waiting period"
      ],
      "sourceUrl": "https://www.greateasternlife.com/sg/en/personal-insurance/our-products/life-insurance/supreme-health-ci.html",
      "dataAsOf": "2026-09-18",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "ge_ci_early_saver",
      "insurerId": "greateastern",
      "insurerName": "Great Eastern",
      "planName": "CI EarlySaver",
      "category": "critical_illness",
      "coverageAmount": 100000,
      "premiums": {
        "male_30_nonsmoker": 720,
        "male_40_nonsmoker": 1290,
        "female_30_nonsmoker": 580,
        "female_40_nonsmoker": 1060
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "20_years"
      ],
      "illnessesCovered": 36,
      "earlyStageConditions": true,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Multi-stage payout: 25% at early, 75% at advanced stage",
        "No-claim bonus: 10% of sum assured after 3 clean years",
        "Covers 36 conditions across all stages",
        "Guaranteed renewal at end of term"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "HIV/AIDS",
        "War and acts of terrorism",
        "90-day waiting period"
      ],
      "sourceUrl": "https://www.greateasternlife.com/sg/en/personal-insurance/our-products/life-insurance/ci-earlysaver.html",
      "dataAsOf": "2026-09-18",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "income_ci_classic",
      "insurerId": "income",
      "insurerName": "NTUC Income",
      "planName": "Cancer Protect Classic",
      "category": "critical_illness",
      "coverageAmount": 100000,
      "premiums": {
        "male_30_nonsmoker": 520,
        "male_40_nonsmoker": 920,
        "female_30_nonsmoker": 430,
        "female_40_nonsmoker": 780
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "to_age_65",
        "to_age_70"
      ],
      "illnessesCovered": 10,
      "earlyStageConditions": true,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Focused coverage on top 10 cancers affecting Singaporeans",
        "Early and advanced stage cancer coverage",
        "Multiple claims allowed for different cancer types",
        "Cancer screening benefit included"
      ],
      "exclusions": [
        "Pre-existing cancers",
        "Skin cancers except malignant melanoma",
        "Cancers arising from HIV infection",
        "90-day waiting period"
      ],
      "sourceUrl": "https://www.income.com.sg/life-insurance/cancer-protect-classic",
      "dataAsOf": "2026-09-22",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "income_ci_multiplier",
      "insurerId": "income",
      "insurerName": "NTUC Income",
      "planName": "CI Multiplier",
      "category": "critical_illness",
      "coverageAmount": 200000,
      "premiums": {
        "male_30_nonsmoker": 1450,
        "male_40_nonsmoker": 2520,
        "female_30_nonsmoker": 1160,
        "female_40_nonsmoker": 2080
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "to_age_70",
        "whole_life"
      ],
      "illnessesCovered": 42,
      "earlyStageConditions": true,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Multiplier benefit: claim up to 5x sum assured across multiple claims",
        "Covers 42 critical illnesses across all stages",
        "Annual limit of 100% sum assured per year",
        "Waiver of premium on claim",
        "Death benefit if no CI claim made"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Congenital defects",
        "Self-inflicted injuries",
        "30-day waiting period for death, 90-day for CI"
      ],
      "sourceUrl": "https://www.income.com.sg/life-insurance/ci-multiplier",
      "dataAsOf": "2026-09-22",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "income_starhealth_ci",
      "insurerId": "income",
      "insurerName": "NTUC Income",
      "planName": "Star Health Plus CI Rider",
      "category": "critical_illness",
      "coverageAmount": 75000,
      "premiums": {
        "male_30_nonsmoker": 420,
        "male_40_nonsmoker": 740,
        "female_30_nonsmoker": 340,
        "female_40_nonsmoker": 620
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "to_age_65"
      ],
      "illnessesCovered": 30,
      "earlyStageConditions": false,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Affordable rider for existing NTUC Income policyholders",
        "Top 30 critical illnesses covered",
        "Simplified underwriting process",
        "Convertible to standalone policy within 5 years"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Conditions arising from alcohol or drug abuse",
        "HIV/AIDS-related conditions",
        "90-day waiting period"
      ],
      "sourceUrl": "https://www.income.com.sg/life-insurance/star-health-plus-ci-rider",
      "dataAsOf": "2026-09-22",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "manulife_ci_care",
      "insurerId": "manulife",
      "insurerName": "Manulife Singapore",
      "planName": "ManuCare CI Saver",
      "category": "critical_illness",
      "coverageAmount": 150000,
      "premiums": {
        "male_30_nonsmoker": 1020,
        "male_40_nonsmoker": 1780,
        "female_30_nonsmoker": 820,
        "female_40_nonsmoker": 1470
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "20_years",
        "to_age_70"
      ],
      "illnessesCovered": 36,
      "earlyStageConditions": true,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Coverage across early, intermediate and advanced CI stages",
        "5% no-claim bonus accrued annually up to 25%",
        "Return of premium benefit if no claim by policy end",
        "Juvenile CI coverage option for children"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Conditions caused by war or nuclear events",
        "Self-inflicted injuries",
        "90-day waiting period"
      ],
      "sourceUrl": "https://www.manulife.com.sg/en/individual/products/health-insurance/manucare-ci-saver.html",
      "dataAsOf": "2026-09-25",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "manulife_ci_prime",
      "insurerId": "manulife",
      "insurerName": "Manulife Singapore",
      "planName": "ManuCare Critical Prime",
      "category": "critical_illness",
      "coverageAmount": 300000,
      "premiums": {
        "male_30_nonsmoker": 1950,
        "male_40_nonsmoker": 3400,
        "female_30_nonsmoker": 1560,
        "female_40_nonsmoker": 2750
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "to_age_70",
        "whole_life"
      ],
      "illnessesCovered": 45,
      "earlyStageConditions": true,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Widest coverage: 45 critical illnesses across all stages",
        "Comprehensive early-stage cancer coverage",
        "Premium waiver on any critical illness claim",
        "Additional 50% payout for child critical illness rider",
        "Global second medical opinion service included"
      ],
      "exclusions": [
        "Pre-existing conditions declared at application",
        "Conditions arising from self-inflicted injury",
        "HIV/AIDS unless contracted through blood transfusion",
        "90-day waiting period for most CI conditions",
        "30-day waiting period for death benefit"
      ],
      "sourceUrl": "https://www.manulife.com.sg/en/individual/products/health-insurance/manucare-critical-prime.html",
      "dataAsOf": "2026-09-25",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    },
    {
      "id": "manulife_readyprotect",
      "insurerId": "manulife",
      "insurerName": "Manulife Singapore",
      "planName": "ReadyProtect CI",
      "category": "critical_illness",
      "coverageAmount": 50000,
      "premiums": {
        "male_30_nonsmoker": 350,
        "male_40_nonsmoker": 610,
        "female_30_nonsmoker": 280,
        "female_40_nonsmoker": 500
      },
      "premiumFrequency": "annual",
      "coverageTerms": [
        "5_years"
      ],
      "illnessesCovered": 30,
      "earlyStageConditions": false,
      "payoutType": "lump_sum",
      "keyBenefits": [
        "Short-term 5-year renewable CI plan",
        "No medical examination required up to $50,000",
        "Online application with instant cover",
        "Guaranteed renewable every 5 years up to age 70"
      ],
      "exclusions": [
        "Pre-existing conditions",
        "Congenital and hereditary conditions",
        "Conditions known before application",
        "90-day waiting period"
      ],
      "sourceUrl": "https://www.manulife.com.sg/en/individual/products/health-insurance/readyprotect-ci.html",
      "dataAsOf": "2026-09-25",
      "updatedBadge": false,
      "changeNotes": [],
      "version": 1,
      "scrapedAt": "2026-10-01T00:00:00.000Z"
    }
  ],
  sources: [
    {
      "id": "src_aia_ci_power",
      "insurerId": "aia",
      "label": "AIA Critical Cover Power brochure",
      "url": "https://www.aia.com.sg/en/our-products/critical-illness/aia-critical-cover-power.html",
      "type": "product_page",
      "planIds": [
        "aia_ci_power"
      ],
      "etag": null,
      "lastModified": null,
      "contentHash": null,
      "lastChecked": null,
      "lastChanged": null,
      "status": "pending"
    },
    {
      "id": "src_prudential_prucritical",
      "insurerId": "prudential",
      "label": "Prudential PRUCritical Protect brochure",
      "url": "https://www.prudential.com.sg/products/life-protection/critical-illness/prucritical-protect",
      "type": "product_page",
      "planIds": [
        "prudential_prucritical"
      ],
      "etag": null,
      "lastModified": null,
      "contentHash": null,
      "lastChecked": null,
      "lastChanged": null,
      "status": "pending"
    },
    {
      "id": "src_ge_living_assurance",
      "insurerId": "greateastern",
      "label": "Great Eastern Living Assurance brochure",
      "url": "https://www.greateasternlife.com/sg/en/personal-insurance/our-products/life-insurance/living-assurance.html",
      "type": "product_page",
      "planIds": [
        "ge_living_assurance"
      ],
      "etag": null,
      "lastModified": null,
      "contentHash": null,
      "lastChecked": null,
      "lastChanged": null,
      "status": "pending"
    },
    {
      "id": "src_income_ci_multiplier",
      "insurerId": "income",
      "label": "NTUC Income CI Multiplier brochure",
      "url": "https://www.income.com.sg/life-insurance/ci-multiplier",
      "type": "product_page",
      "planIds": [
        "income_ci_multiplier"
      ],
      "etag": null,
      "lastModified": null,
      "contentHash": null,
      "lastChecked": null,
      "lastChanged": null,
      "status": "pending"
    },
    {
      "id": "src_mock_brochure",
      "insurerId": "manulife",
      "label": "Manulife ManuCare CI Saver (mock brochure — editable)",
      "url": "http://localhost:8100/mock/brochure",
      "type": "mock",
      "planIds": [
        "manulife_ci_care"
      ],
      "etag": null,
      "lastModified": null,
      "contentHash": null,
      "lastChecked": null,
      "lastChanged": null,
      "status": "pending"
    }
  ],
  threads: []
};
