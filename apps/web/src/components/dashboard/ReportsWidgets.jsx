import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatPercentage } from '@/utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * Reports Widgets Component
 * Displays embedded reports data from dashboard response
 * NO separate /reports page - reports live here
 * @param {Object} reports - Reports data from dashboard: { last7Days, topCampaigns, deliveryRateTrend, creditsUsage }
 */
export default function ReportsWidgets({ reports = {} }) {
  const last7Days = reports.last7Days || {};
  const topCampaigns = reports.topCampaigns || [];
  const deliveryRateTrend = reports.deliveryRateTrend || [];
  const creditsUsage = reports.creditsUsage || [];

  if (!reports || Object.keys(reports).length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No reports data available yet. Send some campaigns to see statistics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Last 7 Days Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Last 7 Days Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Sent</p>
              <p className="text-2xl font-bold">{formatNumber(last7Days.sent || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{formatNumber(last7Days.delivered || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{formatNumber(last7Days.failed || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Unsubscribes</p>
              <p className="text-2xl font-bold text-orange-600">{formatNumber(last7Days.unsubscribes || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Campaigns */}
      {topCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Delivery Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCampaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{formatNumber(campaign.sent || 0)}</TableCell>
                    <TableCell className="text-green-600">{formatNumber(campaign.delivered || 0)}</TableCell>
                    <TableCell className="text-red-600">{formatNumber(campaign.failed || 0)}</TableCell>
                    <TableCell>
                      {formatPercentage(
                        campaign.delivered || 0,
                        campaign.sent || 1,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delivery Rate Trend */}
      {deliveryRateTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Rate Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={deliveryRateTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Line type="monotone" dataKey="deliveredRate" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Credits Usage Trend */}
      {creditsUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Credits Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={creditsUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="creditsDebited" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

