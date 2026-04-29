import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Head from "next/head";
import { getRequestDetails, Supplier } from "@/api";
import DashboardLayout from "@/components/DashboardLayout";

export default function SupplierDetailPage() {
  const router = useRouter();
  const { id, supplierId } = router.query;
  const requestId = id as string;
  const targetSupplierId = supplierId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["requestDetails", requestId],
    queryFn: () => getRequestDetails(requestId),
    enabled: !!requestId && router.isReady,
    retry: false,
  });

  const suppliers = data?.data?.suppliers || [];
  const request = data?.data?.request;
  const index = suppliers.findIndex((s) => s.id === targetSupplierId);
  const supplier: Supplier | undefined = index >= 0 ? suppliers[index] : undefined;

  if (isLoading || !router.isReady) {
    return (
      <>
        <Head>
          <title>Supplier Details - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="max-w-5xl mx-auto text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading supplier details...</p>
          </div>
        </DashboardLayout>
      </>
    );
  }

  if (error || !supplier) {
    return (
      <>
        <Head>
          <title>Supplier Not Found - Optiverifi</title>
        </Head>
        <DashboardLayout>
          <div className="max-w-5xl mx-auto py-12 px-4">
            <Link
              href={`/requests/${requestId}`}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <span>&larr; Back to matched suppliers</span>
            </Link>
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <p className="text-red-600 font-medium">Supplier not found</p>
              <p className="text-sm text-red-500 mt-1">
                This supplier may have been removed or the link is invalid.
              </p>
            </div>
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{supplier.name} - Optiverifi</title>
      </Head>
      <DashboardLayout>
        <div className="max-w-5xl mx-auto py-8 px-4">
          <Link
            href={`/requests/${requestId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <span>&larr; Back to matched suppliers</span>
          </Link>

          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
                  {supplier.ranking && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      Rank #{supplier.ranking}
                    </span>
                  )}
                  {supplier.verified && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      Verified
                    </span>
                  )}
                </div>
                {supplier.supplierNumber && (
                  <p className="text-sm text-gray-500">{supplier.supplierNumber}</p>
                )}
                {request?.name && (
                  <p className="text-sm text-gray-500 mt-1">
                    Matched to <span className="font-medium text-gray-700">{request.name}</span>
                  </p>
                )}
              </div>
              {supplier.matchScore !== undefined && (
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Match Score
                  </span>
                  <span className="text-3xl font-bold text-blue-600">{supplier.matchScore}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Why They Match */}
          {supplier.aiExplanation && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Why They Match</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{supplier.aiExplanation}</p>
            </div>
          )}

          {/* Positioning */}
          {supplier.positioning && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Positioning
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {supplier.positioning}
              </p>
            </div>
          )}

          {/* Two-column body */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Contact Information">
              <Field label="Contact Name" value={supplier.contactName} />
              <Field label="Email" value={supplier.email} href={`mailto:${supplier.email}`} />
              <Field label="Phone" value={supplier.phone} href={`tel:${supplier.phone}`} />
              <Field label="Website" value={supplier.website} href={supplier.website} external />
            </Card>

            <Card title="Location">
              <Field label="State / Region" value={supplier.stateRegion} />
              <Field label="City" value={supplier.city} />
              <Field label="Country" value={supplier.country} />
            </Card>

            <Card title="Category">
              <Field label="Category" value={supplier.category} />
              <Field label="Subcategory" value={supplier.subCategory} />
              <Field label="Industry" value={supplier.industry} />
              <Field label="Diversity Type" value={supplier.diversityType} />
            </Card>

            <Card title="Order & Capacity">
              <Field label="Min Order Quantity" value={supplier.minOrderQuantity} />
              <Field label="Lead Time" value={supplier.leadTime} />
            </Card>

            <Card title="Verification & Risk">
              <Field label="Reliability" value={supplier.reliability} />
              <Field label="Risk Flags" value={supplier.riskFlags} />
              <Field label="Data Source" value={supplier.dataSource} />
              <Field
                label="Last Verified"
                value={
                  supplier.lastVerifiedDate !== undefined && supplier.lastVerifiedDate !== null
                    ? String(supplier.lastVerifiedDate)
                    : undefined
                }
              />
            </Card>

            {supplier.capabilities && supplier.capabilities.length > 0 && (
              <Card title="Capabilities">
                <div className="flex flex-wrap gap-2">
                  {supplier.capabilities.map((cap, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {supplier.certifications && supplier.certifications.length > 0 && (
              <Card title="Certifications">
                <div className="flex flex-wrap gap-2">
                  {supplier.certifications.map((cert, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium"
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {supplier.tags && supplier.tags.length > 0 && (
              <Card title="Tags">
                <div className="flex flex-wrap gap-2">
                  {supplier.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Full-width sections */}
          {supplier.internalNotes && (
            <Card title="Internal Notes" className="mt-6" wide>
              <p className="text-sm text-gray-700 leading-relaxed bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                {supplier.internalNotes}
              </p>
            </Card>
          )}

          {supplier.buyerMatchRecommendation && (
            <Card title="Match Recommendation" className="mt-6" wide>
              <p className="text-sm text-gray-700 leading-relaxed">
                {supplier.buyerMatchRecommendation}
              </p>
            </Card>
          )}

          {/* Prev / Next nav */}
          {suppliers.length > 1 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
              {index > 0 && suppliers[index - 1]?.id ? (
                <Link
                  href={`/requests/${requestId}/suppliers/${suppliers[index - 1].id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span>&larr; Previous supplier</span>
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-gray-500">
                {index + 1} of {suppliers.length}
              </span>
              {index < suppliers.length - 1 && suppliers[index + 1]?.id ? (
                <Link
                  href={`/requests/${requestId}/suppliers/${suppliers[index + 1].id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span>Next supplier &rarr;</span>
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}

function Card({
  title,
  children,
  className = "",
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {wide ? (
        children
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value?: string | null;
  href?: string;
  external?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 break-all"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm font-medium text-gray-900 break-words">{value}</p>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
