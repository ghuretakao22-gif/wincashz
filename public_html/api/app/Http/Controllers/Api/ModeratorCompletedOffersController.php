<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ModeratorCompletedOffersController extends Controller
{
    /**
     * Get paginated completed offers strictly scoped to the authenticated moderator's My ID.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $myIdCode = trim((string) ($user?->my_id ?? ''));

        if ($myIdCode === '' || !Schema::hasTable('my_id_earnings')) {
            return response()->json([
                'status' => 'success',
                'data' => [],
                'pagination' => [
                    'currentPage' => 1,
                    'lastPage' => 1,
                    'perPage' => 25,
                    'total' => 0,
                    'from' => 0,
                    'to' => 0,
                ],
                'summary' => [
                    'total_offers' => 0,
                    'total_usd' => 0.0,
                    'total_bdt' => 0.0,
                ],
                'providers' => [],
                'months' => [Carbon::now('UTC')->format('Y-m')],
            ]);
        }

        $currentMonth = Carbon::now('UTC')->format('Y-m');
        $todayDate = Carbon::now('UTC')->format('Y-m-d');

        // Fetch distinct available providers for this My ID
        $providers = DB::table('my_id_earnings')
            ->where('my_id_code', $myIdCode)
            ->whereNotNull('provider')
            ->where('provider', '!=', '')
            ->distinct()
            ->orderBy('provider')
            ->pluck('provider')
            ->values()
            ->all();

        // Fetch distinct available months for this My ID
        $monthsRaw = DB::table('my_id_earnings')
            ->where('my_id_code', $myIdCode)
            ->selectRaw("DISTINCT SUBSTR(COALESCE(completed_at, created_at), 1, 7) as month_val")
            ->whereNotNull(DB::raw("COALESCE(completed_at, created_at)"))
            ->orderByDesc('month_val')
            ->pluck('month_val')
            ->filter(fn ($m) => !empty($m) && preg_match('/^\d{4}-\d{2}$/', (string) $m))
            ->values()
            ->all();

        $allMonths = array_values(array_unique(array_merge([$currentMonth], $monthsRaw)));
        rsort($allMonths);

        // Filters
        $query = $this->moderatorCompletedOffersBaseQuery($request, $myIdCode);

        // Compute summary for the filtered result set
        $summaryRow = (clone $query)->reorder()->selectRaw('
            COUNT(*) as total_offers,
            COALESCE(SUM(my_id_earnings.payout_usd), 0) as total_usd,
            COALESCE(SUM(my_id_earnings.payout_bdt), 0) as total_bdt
        ')->first();

        $totalOffers = (int) ($summaryRow->total_offers ?? 0);
        $totalUsd = round((float) ($summaryRow->total_usd ?? 0), 2);
        $totalBdt = round((float) ($summaryRow->total_bdt ?? 0), 2);

        $allowedPerPage = [20, 25, 50, 100];
        $perPage = (int) $request->input('per_page', 25);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 25;
        }

        $hasCompletedTasks = Schema::hasTable('completed_tasks');

        $selectFields = [
            'my_id_earnings.id',
            'my_id_earnings.user_id',
            'my_id_earnings.completed_task_id',
            'my_id_earnings.provider',
            'my_id_earnings.offer_id',
            'my_id_earnings.offer_name',
            'my_id_earnings.coin_amount',
            'my_id_earnings.payout_usd',
            'my_id_earnings.usd_bdt_rate',
            'my_id_earnings.payout_bdt',
            'my_id_earnings.completed_at',
            'my_id_earnings.created_at',
            'users.username',
            'users.name as user_name',
            'users.email as user_email',
        ];

        if ($hasCompletedTasks) {
            $selectFields[] = 'completed_tasks.transaction_id';
        }

        $paginator = $query->select($selectFields)->paginate($perPage);

        $items = collect($paginator->items())->map(function ($row) {
            $rawDate = $row->completed_at ?: $row->created_at;
            $dt = $rawDate ? Carbon::parse($rawDate) : null;

            // Mask email for user privacy: e.g. "jo***@gmail.com"
            $email = trim((string) ($row->user_email ?? ''));
            $maskedEmail = '—';
            if ($email !== '' && str_contains($email, '@')) {
                [$local, $domain] = explode('@', $email, 2);
                $maskedEmail = (strlen($local) <= 2)
                    ? substr($local, 0, 1) . '***@' . $domain
                    : substr($local, 0, 2) . '***@' . $domain;
            }

            $payoutUsd = (float) ($row->payout_usd ?? 0);

            return [
                'id' => (int) $row->id,
                'completed_task_id' => $row->completed_task_id ? (int) $row->completed_task_id : null,
                'transaction_id' => (string) ($row->transaction_id ?? ($row->completed_task_id ? 'TX#' . $row->completed_task_id : '—')),
                'user_id' => (int) $row->user_id,
                'username' => (string) ($row->username ?? 'user_' . $row->user_id),
                'user_name' => (string) ($row->user_name ?? ''),
                'user_email' => $maskedEmail,
                'provider' => (string) ($row->provider ?: 'Unknown'),
                'offer_id' => $row->offer_id ?: '—',
                'offer_name' => (string) ($row->offer_name ?: ($row->offer_id ?: 'Standard Offer')),
                'coin_amount' => round((float) ($row->coin_amount ?? 0), 2),
                'payout_usd' => round($payoutUsd, 4),
                'usd_bdt_rate' => round((float) ($row->usd_bdt_rate ?? 0), 2),
                'payout_bdt' => round((float) ($row->payout_bdt ?? 0), 2),
                'status' => $payoutUsd > 0 ? 'Completed' : 'Unmapped',
                'completed_at' => $rawDate,
                'completed_date' => $dt ? $dt->format('d M Y') : '—',
                'completed_time' => $dt ? $dt->format('h:i A') . ' UTC' : '—',
            ];
        })->values()->all();

        $paginationData = [
            'currentPage' => $paginator->currentPage(),
            'lastPage' => $paginator->lastPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem() ?? 0,
            'to' => $paginator->lastItem() ?? 0,
        ];

        $summaryData = [
            'total_records' => $totalOffers,
            'total_offers' => $totalOffers,
            'sum_usd' => $totalUsd,
            'total_usd' => $totalUsd,
            'sum_bdt' => $totalBdt,
            'total_bdt' => $totalBdt,
        ];

        return response()->json([
            'status' => 'success',
            'data' => [
                'data' => $items,
                'items' => $items,
                'pagination' => $paginationData,
                'summary' => $summaryData,
                'providers' => $providers,
                'months' => $allMonths,
            ],
            // Top-level aliases for flexible consumption
            'items' => $items,
            'pagination' => $paginationData,
            'summary' => $summaryData,
            'providers' => $providers,
            'months' => $allMonths,
        ]);
    }

    /**
     * Reusable query builder for moderator completed offers strictly scoped to My ID.
     */
    public function moderatorCompletedOffersBaseQuery(Request $request, string $myIdCode)
    {
        $currentMonth = Carbon::now('UTC')->format('Y-m');
        $todayDate = Carbon::now('UTC')->format('Y-m-d');

        // Filters
        $period = strtolower(trim((string) $request->input('period', '')));
        $month = trim((string) $request->input('month', ''));
        $date = trim((string) $request->input('date', ''));
        $provider = trim((string) $request->input('provider', ''));
        $search = trim((string) $request->input('search', ''));
        $userIdInput = $request->input('user_id');

        $hasCompletedTasks = Schema::hasTable('completed_tasks');

        $query = DB::table('my_id_earnings')
            ->leftJoin('users', 'users.id', '=', 'my_id_earnings.user_id');

        if ($hasCompletedTasks) {
            $query->leftJoin('completed_tasks', 'completed_tasks.id', '=', 'my_id_earnings.completed_task_id');
        }

        $query->where('my_id_earnings.my_id_code', $myIdCode);

        // Strict scoping: only users created by/belonging to this moderator
        if (Schema::hasColumn('users', 'my_id')) {
            $query->where('users.my_id', $myIdCode);
        }

        // Date / Month / Period filter (UTC, half-open ranges [start, end))
        // Precedence: valid date wins over month and period; valid month wins over period
        $isValidDate = ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date));
        $isValidMonth = ($month !== '' && preg_match('/^\d{4}-\d{2}$/', $month));

        if ($isValidDate) {
            $start = Carbon::createFromFormat('Y-m-d', $date, 'UTC')->startOfDay();
            $end = (clone $start)->addDay();
            $startStr = $start->toDateTimeString();
            $endStr = $end->toDateTimeString();

            $query->where(function ($q) use ($startStr, $endStr) {
                $q->where(function ($sub) use ($startStr, $endStr) {
                    $sub->where('my_id_earnings.completed_at', '>=', $startStr)
                        ->where('my_id_earnings.completed_at', '<', $endStr);
                })->orWhere(function ($q2) use ($startStr, $endStr) {
                    $q2->whereNull('my_id_earnings.completed_at')
                       ->where('my_id_earnings.created_at', '>=', $startStr)
                       ->where('my_id_earnings.created_at', '<', $endStr);
                });
            });
        } elseif ($isValidMonth) {
            $start = Carbon::createFromFormat('Y-m', $month, 'UTC')->startOfMonth();
            $end = (clone $start)->addMonth();
            $startStr = $start->toDateTimeString();
            $endStr = $end->toDateTimeString();

            $query->where(function ($q) use ($startStr, $endStr) {
                $q->where(function ($sub) use ($startStr, $endStr) {
                    $sub->where('my_id_earnings.completed_at', '>=', $startStr)
                        ->where('my_id_earnings.completed_at', '<', $endStr);
                })->orWhere(function ($q2) use ($startStr, $endStr) {
                    $q2->whereNull('my_id_earnings.completed_at')
                       ->where('my_id_earnings.created_at', '>=', $startStr)
                       ->where('my_id_earnings.created_at', '<', $endStr);
                });
            });
        } elseif ($period === 'today') {
            $start = Carbon::now('UTC')->startOfDay();
            $end = (clone $start)->addDay();
            $startStr = $start->toDateTimeString();
            $endStr = $end->toDateTimeString();

            $query->where(function ($q) use ($startStr, $endStr) {
                $q->where(function ($sub) use ($startStr, $endStr) {
                    $sub->where('my_id_earnings.completed_at', '>=', $startStr)
                        ->where('my_id_earnings.completed_at', '<', $endStr);
                })->orWhere(function ($q2) use ($startStr, $endStr) {
                    $q2->whereNull('my_id_earnings.completed_at')
                       ->where('my_id_earnings.created_at', '>=', $startStr)
                       ->where('my_id_earnings.created_at', '<', $endStr);
                });
            });
        } elseif ($period === 'all') {
            // No date filter
        } elseif ($period === 'this_month') {
            $start = Carbon::now('UTC')->startOfMonth();
            $end = (clone $start)->addMonth();
            $startStr = $start->toDateTimeString();
            $endStr = $end->toDateTimeString();

            $query->where(function ($q) use ($startStr, $endStr) {
                $q->where(function ($sub) use ($startStr, $endStr) {
                    $sub->where('my_id_earnings.completed_at', '>=', $startStr)
                        ->where('my_id_earnings.completed_at', '<', $endStr);
                })->orWhere(function ($q2) use ($startStr, $endStr) {
                    $q2->whereNull('my_id_earnings.completed_at')
                       ->where('my_id_earnings.created_at', '>=', $startStr)
                       ->where('my_id_earnings.created_at', '<', $endStr);
                });
            });
        }

        // Provider filter
        if ($provider !== '' && strtolower($provider) !== 'all') {
            $query->whereRaw('LOWER(TRIM(my_id_earnings.provider)) = ?', [strtolower($provider)]);
        }

        // User ID filter
        if ($userIdInput !== null && $userIdInput !== '' && is_numeric($userIdInput)) {
            $query->where('my_id_earnings.user_id', (int) $userIdInput);
        }

        // Free-text search
        if ($search !== '') {
            $escaped = addcslashes($search, '%_\\');
            $like = '%' . $escaped . '%';
            $isNumeric = is_numeric($search);
            $numVal = $isNumeric ? (int) $search : -1;

            $query->where(function ($q) use ($like, $isNumeric, $numVal, $hasCompletedTasks) {
                $q->where('users.username', 'like', $like)
                  ->orWhere('users.name', 'like', $like)
                  ->orWhere('users.email', 'like', $like)
                  ->orWhere('my_id_earnings.offer_name', 'like', $like)
                  ->orWhere('my_id_earnings.offer_id', 'like', $like)
                  ->orWhere('my_id_earnings.provider', 'like', $like);

                if ($hasCompletedTasks) {
                    $q->orWhere('completed_tasks.transaction_id', 'like', $like);
                }

                if ($isNumeric) {
                    $q->orWhere('my_id_earnings.user_id', $numVal)
                      ->orWhere('my_id_earnings.coin_amount', $numVal)
                      ->orWhere('my_id_earnings.completed_task_id', $numVal);
                }
            });
        }

        $query->orderByDesc(DB::raw('COALESCE(my_id_earnings.completed_at, my_id_earnings.created_at)'))
              ->orderByDesc('my_id_earnings.id');

        return $query;
    }

    /**
     * Export completed offers strictly scoped to the authenticated moderator's My ID.
     * Guaranteed NO revenue columns.
     */
    public function export(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        $user = $request->user('api') ?? $request->user();
        $myIdCode = trim((string) ($user?->my_id ?? ''));

        if ($myIdCode === '' || !Schema::hasTable('my_id_earnings')) {
            return $this->generateCsvSpreadsheetResponse([], [], 'moderator-completed-offers-empty.csv');
        }

        $query = $this->moderatorCompletedOffersBaseQuery($request, $myIdCode);
        $hasCompletedTasks = Schema::hasTable('completed_tasks');

        $selectFields = [
            'my_id_earnings.id',
            'my_id_earnings.user_id',
            'my_id_earnings.completed_task_id',
            'my_id_earnings.provider',
            'my_id_earnings.offer_id',
            'my_id_earnings.offer_name',
            'my_id_earnings.coin_amount',
            'my_id_earnings.payout_usd',
            'my_id_earnings.usd_bdt_rate',
            'my_id_earnings.payout_bdt',
            'my_id_earnings.completed_at',
            'my_id_earnings.created_at',
            'users.username',
            'users.name as user_name',
            'users.email as user_email',
        ];

        if ($hasCompletedTasks) {
            $selectFields[] = 'completed_tasks.transaction_id';
            $selectFields[] = 'completed_tasks.ip';
            $selectFields[] = 'completed_tasks.country';
        }

        $items = $query->select($selectFields)->get();

        $headers = [
            'S.L',
            'Date (UTC)',
            'Time (UTC)',
            'User ID',
            'Username',
            'Email',
            'Provider',
            'Offer ID',
            'Offer Name',
            'Coin',
            'Payout USD',
            'Payout BDT',
            'Status',
            'My ID',
            'Transaction ID',
            'IP Address',
            'Country',
        ];

        $rows = [];
        foreach ($items as $idx => $row) {
            $rawDate = $row->completed_at ?: $row->created_at;
            $dt = $rawDate ? Carbon::parse($rawDate, 'UTC')->setTimezone('UTC') : null;

            // Mask email for user privacy: e.g. "jo***@gmail.com"
            $email = trim((string) ($row->user_email ?? ''));
            $maskedEmail = '—';
            if ($email !== '' && str_contains($email, '@')) {
                [$local, $domain] = explode('@', $email, 2);
                $maskedEmail = (strlen($local) <= 2)
                    ? substr($local, 0, 1) . '***@' . $domain
                    : substr($local, 0, 2) . '***@' . $domain;
            }

            $payoutUsd = (float) ($row->payout_usd ?? 0);
            $payoutBdt = (float) ($row->payout_bdt ?? 0);

            $rows[] = [
                'sl' => $idx + 1,
                'date' => $dt ? $dt->format('Y-m-d') : '',
                'time' => $dt ? $dt->format('H:i:s') : '',
                'user_id' => (int) $row->user_id,
                'username' => (string) ($row->username ?: ('user_' . $row->user_id)),
                'email' => $maskedEmail,
                'provider' => (string) ($row->provider ?: 'Unknown'),
                'offer_id' => (string) ($row->offer_id ?: '—'),
                'offer_name' => (string) ($row->offer_name ?: ($row->offer_id ?: 'Standard Offer')),
                'coin' => (float) ($row->coin_amount ?? 0),
                'payout_usd' => round($payoutUsd, 4),
                'payout_bdt' => round($payoutBdt, 2),
                'status' => $payoutUsd > 0 ? 'Completed' : 'Unmapped',
                'my_id' => $myIdCode,
                'transaction_id' => (string) ($row->transaction_id ?? ('TX-' . $row->id)),
                'ip' => (string) ($row->ip ?? '—'),
                'country' => (string) ($row->country ?? '—'),
            ];
        }

        $period = strtolower(trim((string) $request->input('period', '')));
        $month = trim((string) $request->input('month', ''));
        $date = trim((string) $request->input('date', ''));

        if ($date !== '' && strtolower($date) !== 'all') {
            $periodSuffix = $date;
        } elseif ($month !== '' && strtolower($month) !== 'all') {
            $periodSuffix = $month;
        } elseif ($period !== '') {
            $periodSuffix = $period;
        } else {
            $periodSuffix = Carbon::now('UTC')->format('Y-m');
        }

        $baseName = 'moderator-completed-offers-' . $myIdCode . '-' . $periodSuffix;
        $format = strtolower((string) $request->input('format', 'xlsx'));

        if ($format === 'csv') {
            return $this->generateCsvSpreadsheetResponse($headers, $rows, $baseName . '.csv');
        }

        return $this->generateOpenXmlSpreadsheetResponse($headers, $rows, $baseName . '.xlsx', 'Completed Offers');
    }

    private function generateOpenXmlSpreadsheetResponse(array $headers, array $rows, string $filename, string $sheetName = 'Completed Offers'): \Symfony\Component\HttpFoundation\Response
    {
        $zip = new \ZipArchive();
        $tempFile = tempnam(sys_get_temp_dir(), 'wincashz_mod_xlsx_');

        if ($zip->open($tempFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            return $this->generateCsvSpreadsheetResponse($headers, $rows, str_replace('.xlsx', '.csv', $filename));
        }

        $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetData>'
            . '<row r="1">';

        foreach ($headers as $h) {
            $escaped = htmlspecialchars($h, ENT_XML1, 'UTF-8');
            $sheetXml .= '<c t="inlineStr"><is><t>' . $escaped . '</t></is></c>';
        }
        $sheetXml .= '</row>' . "\n";

        foreach ($rows as $idx => $r) {
            $rowNum = $idx + 2;
            $sheetXml .= '<row r="' . $rowNum . '">';
            $values = is_array($r) ? array_values($r) : [];
            foreach ($values as $colIdx => $val) {
                // Numeric columns: S.L (col 0), User ID (col 3), Coin (col 9), Payout USD (col 10), Payout BDT (col 11)
                $isNumericCol = in_array($colIdx, [0, 3, 9, 10, 11], true);
                if ($isNumericCol && is_numeric($val)) {
                    $sheetXml .= '<c><v>' . (0 + $val) . '</v></c>';
                } else {
                    $escaped = htmlspecialchars((string) ($val ?? ''), ENT_XML1, 'UTF-8');
                    $sheetXml .= '<c t="inlineStr"><is><t>' . $escaped . '</t></is></c>';
                }
            }
            $sheetXml .= '</row>' . "\n";
        }

        $sheetXml .= '</sheetData></worksheet>';

        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '</Types>';

        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';

        $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets>'
            . '<sheet name="' . htmlspecialchars($sheetName, ENT_XML1, 'UTF-8') . '" sheetId="1" r:id="rId1"/>'
            . '</sheets>'
            . '</workbook>';

        $workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '</Relationships>';

        $zip->addFromString('[Content_Types].xml', $contentTypes);
        $zip->addFromString('_rels/.rels', $rels);
        $zip->addFromString('xl/workbook.xml', $workbook);
        $zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRels);
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
        $zip->close();

        $content = file_get_contents($tempFile);
        @unlink($tempFile);

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'max-age=0, no-cache, must-revalidate, proxy-revalidate',
        ]);
    }

    private function generateCsvSpreadsheetResponse(array $headers, array $rows, string $filename): \Symfony\Component\HttpFoundation\Response
    {
        $handle = fopen('php://memory', 'r+');
        // UTF-8 BOM
        fputs($handle, "\xEF\xBB\xBF");
        fputcsv($handle, $headers);

        foreach ($rows as $r) {
            $values = is_array($r) ? array_values($r) : [];
            fputcsv($handle, $values);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'max-age=0, no-cache, must-revalidate, proxy-revalidate',
        ]);
    }
}
