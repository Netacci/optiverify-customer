import pdfMake from "pdfmake/build/pdfmake";

// Dynamically import fonts to avoid SSR issues in Next.js
let fontsLoaded = false;

async function loadFonts() {
  if (fontsLoaded) return;
  
  try {
    // The vfs_fonts module exports font files directly as the vfs object
    const pdfFontsModule = await import("pdfmake/build/vfs_fonts");
    
    // The module itself is the vfs (contains font file keys)
    const vfs = 
      pdfFontsModule.default ||
      pdfFontsModule.vfs ||
      pdfFontsModule;
    
    if (vfs && typeof vfs === "object") {
      // @ts-ignore - pdfMake.vfs is a valid property
      pdfMake.vfs = vfs;
      fontsLoaded = true;
    } else {
      throw new Error("Could not find vfs in pdfFonts");
    }
  } catch (error) {
    console.error("Error loading pdfmake fonts:", error);
    // Fallback: try require for server-side rendering
    if (typeof require !== "undefined") {
      try {
        const pdfFonts = require("pdfmake/build/vfs_fonts");
        // The module itself is the vfs
        // @ts-ignore
        pdfMake.vfs = pdfFonts;
        fontsLoaded = true;
      } catch (e) {
        console.error("Fallback font loading also failed:", e);
        console.warn("PDF generation may fail without fonts loaded");
      }
    }
  }
}

interface Supplier {
  name: string;
  location: string;
  email: string;
  phone?: string;
  website?: string;
  description?: string;
  matchScore?: number;
  ranking?: number;
  aiExplanation?: string;
  strengths?: string[];
  leadTime?: string;
  minOrderQuantity?: string;
}

interface RequestDetails {
  name?: string;
  category?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalAmount?: number;
  timeline?: string;
  location?: string;
  requirements?: string;
  matchedCount?: number;
  matchScore?: number;
  createdAt?: string;
}

export async function generateMatchReportPDF(
  request: RequestDetails,
  suppliers: Supplier[]
) {
  // Ensure fonts are loaded before generating PDF
  await loadFonts();
  
  const docDefinition: any = {
    watermark: {
      text: "optiverifi",
      color: "#e0e0e0",
      opacity: 0.1,
      bold: true,
      italics: false,
      fontSize: 60,
    },
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      lineHeight: 1.4,
    },
    header: {
      margin: [40, 20, 40, 0],
      columns: [
        {
          text: "Match Report",
          fontSize: 24,
          bold: true,
          color: "#1f2937",
        },
        {
          text: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          fontSize: 10,
          color: "#6b7280",
          alignment: "right",
        },
      ],
    },
    content: [
      // Request Summary Section
      {
        text: "Request Summary",
        style: "sectionHeader",
        margin: [0, 0, 0, 12],
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              request.name && {
                text: [
                  { text: "Item Name: ", bold: true },
                  request.name,
                ],
                margin: [0, 0, 0, 6],
              },
              request.category && {
                text: [
                  { text: "Category: ", bold: true },
                  request.category,
                ],
                margin: [0, 0, 0, 6],
              },
              request.description && {
                text: [
                  { text: "Description: ", bold: true },
                  request.description,
                ],
                margin: [0, 0, 0, 6],
              },
            ].filter(Boolean),
          },
          {
            width: "*",
            stack: [
              request.quantity && {
                text: [
                  { text: "Quantity: ", bold: true },
                  request.quantity.toString(),
                ],
                margin: [0, 0, 0, 6],
              },
              request.unitPrice && {
                text: [
                  { text: "Unit Price: ", bold: true },
                  `$${request.unitPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                ],
                margin: [0, 0, 0, 6],
              },
              request.totalAmount && {
                text: [
                  { text: "Total Amount: ", bold: true },
                  `$${request.totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                ],
                margin: [0, 0, 0, 6],
              },
            ].filter(Boolean),
          },
        ],
        margin: [0, 0, 0, 12],
      },
      // Additional Details
      ...(request.timeline || request.location || request.requirements
        ? [
            {
              columns: [
                request.timeline && {
                  width: "*",
                  stack: [
                    {
                      text: "Timeline",
                      bold: true,
                      margin: [0, 0, 0, 4],
                    },
                    {
                      text: request.timeline,
                      margin: [0, 0, 0, 12],
                    },
                  ],
                },
                request.location && {
                  width: "*",
                  stack: [
                    {
                      text: "Location",
                      bold: true,
                      margin: [0, 0, 0, 4],
                    },
                    {
                      text: request.location,
                      margin: [0, 0, 0, 12],
                    },
                  ],
                },
              ].filter(Boolean),
            },
            request.requirements && {
              stack: [
                {
                  text: "Requirements",
                  bold: true,
                  margin: [0, 0, 0, 4],
                },
                {
                  text: request.requirements,
                  margin: [0, 0, 0, 20],
                },
              ],
            },
          ]
        : []),
      // Match Statistics
      {
        columns: [
          {
            width: "*",
            text: [
              { text: "Suppliers Matched: ", bold: true },
              (request.matchedCount || suppliers.length).toString(),
            ],
            margin: [0, 0, 0, 6],
          },
          request.matchScore && {
            width: "*",
            text: [
              { text: "Match Score: ", bold: true },
              `${request.matchScore}%`,
            ],
            margin: [0, 0, 0, 6],
          },
        ].filter(Boolean),
        margin: [0, 0, 0, 20],
      },
      // Suppliers Section
      {
        text: "Matched Suppliers",
        style: "sectionHeader",
        margin: [0, 0, 0, 12],
      },
      ...suppliers.map((supplier, index) => ({
        stack: [
          {
            text: `${index + 1}. ${supplier.name}`,
            style: "supplierName",
            margin: [0, 0, 0, 8],
          },
          {
            columns: [
              {
                width: "*",
                stack: [
                  {
                    text: [
                      { text: "Location: ", bold: true },
                      supplier.location,
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  {
                    text: [
                      { text: "Email: ", bold: true },
                      supplier.email,
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  supplier.phone && {
                    text: [
                      { text: "Phone: ", bold: true },
                      supplier.phone,
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  supplier.website && {
                    text: [
                      { text: "Website: ", bold: true },
                      supplier.website,
                    ],
                    margin: [0, 0, 0, 4],
                  },
                ].filter(Boolean),
              },
              {
                width: "*",
                stack: [
                  supplier.matchScore && {
                    text: [
                      { text: "Match Score: ", bold: true },
                      `${supplier.matchScore}%`,
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  supplier.leadTime && {
                    text: [
                      { text: "Lead Time: ", bold: true },
                      supplier.leadTime,
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  supplier.minOrderQuantity && {
                    text: [
                      { text: "Min Order Qty: ", bold: true },
                      supplier.minOrderQuantity,
                    ],
                    margin: [0, 0, 0, 4],
                  },
                ].filter(Boolean),
              },
            ],
            margin: [0, 0, 0, 8],
          },
          supplier.description && {
            text: [
              { text: "Description: ", bold: true },
              supplier.description,
            ],
            margin: [0, 0, 0, 8],
          },
          supplier.strengths && supplier.strengths.length > 0 && {
            text: [
              { text: "Strengths: ", bold: true },
              supplier.strengths.join(", "),
            ],
            margin: [0, 0, 0, 8],
          },
          supplier.aiExplanation && {
            text: [
              { text: "AI Analysis: ", bold: true },
              supplier.aiExplanation,
            ],
            margin: [0, 0, 0, 8],
            italics: true,
            color: "#4b5563",
          },
          {
            canvas: [
              {
                type: "line",
                x1: 0,
                y1: 0,
                x2: 515,
                y2: 0,
                lineWidth: 0.5,
                lineColor: "#e5e7eb",
              },
            ],
            margin: [0, 12, 0, 12],
          },
        ].filter(Boolean),
        margin: [0, 0, 0, 12],
      })),
      // Footer
      {
        text: "Generated by Optiverifi",
        fontSize: 8,
        color: "#9ca3af",
        alignment: "center",
        margin: [0, 20, 0, 0],
        italics: true,
      },
    ],
    styles: {
      sectionHeader: {
        fontSize: 16,
        bold: true,
        color: "#1f2937",
        margin: [0, 0, 0, 8],
      },
      supplierName: {
        fontSize: 14,
        bold: true,
        color: "#111827",
      },
    },
  };

  pdfMake.createPdf(docDefinition).download(
    `match-report-${request.name || "request"}-${new Date().toISOString().split("T")[0]}.pdf`
  );
}

