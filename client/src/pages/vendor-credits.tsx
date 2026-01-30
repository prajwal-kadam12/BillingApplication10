import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Trash2, Edit, FileText, ChevronDown, X, Printer, Receipt, Copy, Ban, BookOpen, RotateCcw, CheckCircle2, Download, Eye, ArrowUpDown, RefreshCw, Upload, Grid3X3, Lightbulb } from "lucide-react";
import { robustIframePrint } from "@/lib/robust-print";
import { generatePDFFromElement } from "@/lib/pdf-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/hooks/use-branding";
import { useOrganization } from "@/context/OrganizationContext";
import { PurchasePDFHeader } from "@/components/purchase-pdf-header";
import { Organization } from "@shared/schema";

import { cn } from "@/lib/utils";

interface VendorCreditItem {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  hsnSac?: string;
  account: string;
  quantity: number;
  rate: string | number;
  tax: string;
  amount: number;
}

interface VendorCredit {
  id: string;
  creditNumber: string;
  vendorId: string;
  vendorName: string;
  referenceNumber?: string;
  orderNumber?: string;
  date: string;
  subject?: string;
  reverseCharge?: boolean;
  taxType?: string;
  tdsTcs?: string;
  items: VendorCreditItem[];
  subTotal: number;
  discountType?: string;
  discountValue?: string;
  discountAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  tdsTcsAmount?: number;
  adjustment?: number;
  amount: number;
  balance: number;
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Bill {
  id: string;
  billNumber: string;
  vendorId: string;
  billDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  creditsApplied?: Array<{
    creditId: string;
    creditNumber: string;
    amount: number;
    appliedDate: string;
  }>;
}

interface Vendor {
  id: string;
  displayName: string;
  companyName?: string;
  billingAddress?: {
    attention?: string;
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    countryRegion?: string;
  };
  gstin?: string;
  sourceOfSupply?: string;
}

function SignatureLine() {
  const { data: brandingData } = useBranding();

  if (brandingData?.signature?.url) {
    return (
      <div className="flex flex-col gap-2">
        <img
          src={brandingData.signature.url}
          alt="Authorized Signature"
          style={{ maxWidth: '180px', maxHeight: '60px', objectFit: 'contain' }}
        />
        <p className="text-xs text-muted-foreground">Authorized Signature</p>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">Authorized Signature ____________________</p>
  );
}

export default function VendorCredits() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentView, setCurrentView] = useState("all");

  const viewLabels: Record<string, string> = {
    'all': 'All Vendor Credits',
    'draft': 'Draft',
    'pending_approval': 'Pending Approval',
    'open': 'Open',
    'closed': 'Closed',
    'void': 'Void'
  };
  const [selectedCredit, setSelectedCredit] = useState<VendorCredit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditToDelete, setCreditToDelete] = useState<string | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [activeTab, setActiveTab] = useState("document");
  const [applyToBillsOpen, setApplyToBillsOpen] = useState(false);
  const [vendorBills, setVendorBills] = useState<Bill[]>([]);
  const [creditsToApply, setCreditsToApply] = useState<{ [billId: string]: number }>({});
  const [setAppliedOnDate, setSetAppliedOnDate] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [showPdfView, setShowPdfView] = useState(false);
  const journalTabRef = useRef<HTMLButtonElement>(null);
  const [sortBy, setSortBy] = useState<string>('createdTime');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [preferencesDialogOpen, setPreferencesDialogOpen] = useState(false);

  const { data: vendorCreditsData, isLoading, refetch } = useQuery<{ success: boolean; data: VendorCredit[] }>({
    queryKey: ['/api/vendor-credits'],
  });

  const { data: vendorsData } = useQuery<{ success: boolean; data: Vendor[] }>({
    queryKey: ['/api/vendors'],
  });

  const { data: branding } = useBranding();
  const { currentOrganization } = useOrganization();

  const vendors = vendorsData?.data || [];

  const handleDelete = (id: string) => {
    setCreditToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!creditToDelete) return;
    try {
      const response = await fetch(`/api/vendor-credits/${creditToDelete}`, { method: 'DELETE' });
      if (response.ok) {
        toast({ title: "Vendor credit deleted successfully" });
        if (selectedCredit?.id === creditToDelete) {
          setSelectedCredit(null);
        }
        refetch();
      } else {
        toast({ title: "Failed to delete vendor credit", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Failed to delete vendor credit", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setCreditToDelete(null);
    }
  };

  const handleRefund = () => {
    if (selectedCredit) {
      setRefundAmount(selectedCredit.balance.toString());
      setRefundReason("");
      setRefundDialogOpen(true);
    }
  };

  const confirmRefund = async () => {
    if (!selectedCredit) return;
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedCredit.balance) {
      toast({ title: "Invalid refund amount", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`/api/vendor-credits/${selectedCredit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balance: selectedCredit.balance - amount,
          status: selectedCredit.balance - amount <= 0 ? 'REFUNDED' : selectedCredit.status,
        }),
      });
      if (response.ok) {
        toast({ title: "Refund processed successfully" });
        refetch();
        setRefundDialogOpen(false);
        const updatedCredit = await response.json();
        if (updatedCredit.data) {
          setSelectedCredit(updatedCredit.data);
        }
      } else {
        toast({ title: "Failed to process refund", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Failed to process refund", variant: "destructive" });
    }
  };

  const handleVoid = () => {
    if (selectedCredit) {
      setVoidDialogOpen(true);
    }
  };

  const confirmVoid = async () => {
    if (!selectedCredit) return;
    try {
      const response = await fetch(`/api/vendor-credits/${selectedCredit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VOID' }),
      });
      if (response.ok) {
        toast({ title: "Vendor credit voided successfully" });
        refetch();
        setVoidDialogOpen(false);
        const updatedCredit = await response.json();
        if (updatedCredit.data) {
          setSelectedCredit(updatedCredit.data);
        }
      } else {
        toast({ title: "Failed to void vendor credit", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Failed to void vendor credit", variant: "destructive" });
    }
  };

  const handleClone = async () => {
    if (!selectedCredit) return;
    try {
      const clonedData = {
        vendorId: selectedCredit.vendorId,
        vendorName: selectedCredit.vendorName,
        orderNumber: selectedCredit.orderNumber,
        referenceNumber: selectedCredit.referenceNumber,
        vendorCreditDate: new Date().toISOString().split('T')[0],
        subject: selectedCredit.subject,
        reverseCharge: selectedCredit.reverseCharge,
        taxType: selectedCredit.taxType,
        tdsTcs: selectedCredit.tdsTcs,
        items: selectedCredit.items,
        subTotal: selectedCredit.subTotal,
        discountType: selectedCredit.discountType,
        discountValue: selectedCredit.discountValue,
        discountAmount: selectedCredit.discountAmount,
        cgst: selectedCredit.cgst,
        sgst: selectedCredit.sgst,
        igst: selectedCredit.igst,
        tdsTcsAmount: selectedCredit.tdsTcsAmount,
        adjustment: selectedCredit.adjustment,
        total: selectedCredit.amount,
        notes: selectedCredit.notes,
        status: 'DRAFT',
      };
      const response = await fetch('/api/vendor-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clonedData),
      });
      if (response.ok) {
        const result = await response.json();
        toast({ title: `Vendor credit cloned as ${result.data.creditNumber}` });
        refetch();
        setSelectedCredit(result.data);
      } else {
        toast({ title: "Failed to clone vendor credit", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Failed to clone vendor credit", variant: "destructive" });
    }
  };

  const handleViewJournal = () => {
    setActiveTab("journal");
  };

  const handleApplyToBills = async () => {
    if (!selectedCredit) return;

    try {
      // Fetch unpaid bills for the vendor
      const response = await fetch(`/api/bills?vendorId=${selectedCredit.vendorId}`);
      if (response.ok) {
        const data = await response.json();
        const unpaidBills = data.data.filter((bill: Bill) =>
          bill.status !== 'PAID' && bill.status !== 'VOID' && bill.balanceDue > 0
        );
        setVendorBills(unpaidBills);
        setCreditsToApply({});
        setApplyToBillsOpen(true);
      }
    } catch (error) {
      toast({ title: "Failed to fetch bills", variant: "destructive" });
    }
  };

  const handleCreditAmountChange = (billId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    const bill = vendorBills.find(b => b.id === billId);

    if (!bill || !selectedCredit) return;

    // Validate: don't exceed bill balance or available credit
    const currentTotal = Object.entries(creditsToApply)
      .filter(([id]) => id !== billId)
      .reduce((sum, [, amt]) => sum + amt, 0);

    const availableCredit = selectedCredit.balance - currentTotal;
    const maxApplicable = Math.min(bill.balanceDue, availableCredit);

    if (amount <= maxApplicable && amount >= 0) {
      setCreditsToApply(prev => ({
        ...prev,
        [billId]: amount
      }));
    }
  };

  const getTotalAmountToCredit = () => {
    return Object.values(creditsToApply).reduce((sum, amt) => sum + amt, 0);
  };

  const getRemainingCredits = () => {
    if (!selectedCredit) return 0;
    return selectedCredit.balance - getTotalAmountToCredit();
  };

  const handleSaveApplyCredits = async () => {
    if (!selectedCredit) return;

    const totalToApply = getTotalAmountToCredit();
    if (totalToApply === 0) {
      toast({ title: "No credits to apply", variant: "destructive" });
      return;
    }

    setIsApplying(true);
    try {
      const appliedDate = setAppliedOnDate ? new Date().toISOString().split('T')[0] : selectedCredit.date;

      const response = await fetch(`/api/vendor-credits/${selectedCredit.id}/apply-to-bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditsToApply,
          appliedDate
        })
      });

      if (response.ok) {
        toast({ title: "Credits applied successfully" });
        setApplyToBillsOpen(false);
        refetch();
        // Refresh the selected credit
        const updatedResponse = await fetch(`/api/vendor-credits/${selectedCredit.id}`);
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json();
          setSelectedCredit(updatedData.data);
        }
      } else {
        const error = await response.json();
        toast({ title: error.message || "Failed to apply credits", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Failed to apply credits", variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  // Preferences handler
  const handlePreferences = () => {
    setPreferencesDialogOpen(true);
  };

  // Reset column width handler
  const handleResetColumnWidth = () => {
    toast({ title: "Column widths reset to default" });
  };

  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const vendorCredits = useMemo(() => {
    let result = vendorCreditsData?.data || [];

    // Filter by view
    switch (currentView) {
      case 'draft':
        result = result.filter(c => c.status?.toLowerCase() === 'draft');
        break;
      case 'pending_approval':
        result = result.filter(c => c.status?.toLowerCase().includes('pending'));
        break;
      case 'open':
        result = result.filter(c => c.status?.toLowerCase() === 'open');
        break;
      case 'closed':
        result = result.filter(c => c.status?.toLowerCase() === 'closed');
        break;
      case 'void':
        result = result.filter(c => c.status?.toLowerCase() === 'void' || c.status?.toLowerCase() === 'voided');
        break;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(credit =>
        credit.creditNumber.toLowerCase().includes(query) ||
        credit.vendorName.toLowerCase().includes(query) ||
        (credit.referenceNumber || '').toLowerCase().includes(query)
      );
    }

    if (sortBy) {
      result = [...result].sort((a, b) => {
        let valA: any;
        let valB: any;

        switch (sortBy) {
          case 'name':
            valA = a.vendorName.toLowerCase();
            valB = b.vendorName.toLowerCase();
            break;
          case 'companyName':
            // Since companyName is not directly in VendorCredit, we'd need to join or find it.
            // For now, sorting by vendorName as a fallback if not available
            valA = a.vendorName.toLowerCase();
            valB = b.vendorName.toLowerCase();
            break;
          case 'payables':
            // fallback to amount if payables not clearly defined on credit
            valA = a.amount;
            valB = b.amount;
            break;
          case 'unusedCredits':
            valA = a.balance;
            valB = b.balance;
            break;
          case 'createdTime':
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
            break;
          case 'lastModifiedTime':
            valA = new Date(a.updatedAt).getTime();
            valB = new Date(b.updatedAt).getTime();
            break;
          case 'date':
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
            break;
          case 'amount':
            valA = a.amount;
            valB = b.amount;
            break;
          default:
            valA = (a as any)[sortBy];
            valB = (b as any)[sortBy];
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [vendorCreditsData?.data, searchQuery, sortBy, sortOrder, currentView]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const filteredVendorCredits = vendorCredits;

  // Deep linking for selected vendor credit
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const creditId = searchParams.get('id');
    if (creditId && vendorCredits.length > 0) {
      const credit = vendorCredits.find(c => c.id === creditId);
      if (credit) {
        setSelectedCredit(credit);
      }
    }
  }, [vendorCredits]);

  const { currentPage, totalPages, totalItems, itemsPerPage, paginatedItems, goToPage } = usePagination(filteredVendorCredits, 10);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getVendorDetails = (vendorId: string) => {
    return vendors.find(v => v.id === vendorId);
  };

  const calculateTaxDetails = (credit: VendorCredit) => {
    let cgst = 0;
    let sgst = 0;

    credit.items.forEach(item => {
      if (item.tax && item.tax.includes('gst')) {
        const rate = parseFloat(item.rate.toString());
        const quantity = item.quantity;
        const baseAmount = rate * quantity;

        if (item.tax === 'gst_18') {
          cgst += baseAmount * 0.09;
          sgst += baseAmount * 0.09;
        } else if (item.tax === 'gst_12') {
          cgst += baseAmount * 0.06;
          sgst += baseAmount * 0.06;
        } else if (item.tax === 'gst_5') {
          cgst += baseAmount * 0.025;
          sgst += baseAmount * 0.025;
        }
      }
    });

    return { cgst, sgst };
  };

  const getJournalEntries = (credit: VendorCredit) => {
    const { cgst, sgst } = calculateTaxDetails(credit);
    const costOfGoodsSold = credit.subTotal - (credit.discountAmount || 0);

    const entries = [
      { account: "Accounts Payable", debit: credit.amount, credit: 0 },
      { account: "Input SGST", debit: 0, credit: sgst },
      { account: "Input CGST", debit: 0, credit: cgst },
      { account: "Cost of Goods Sold", debit: 0, credit: costOfGoodsSold },
    ];

    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    return { entries, totalDebit, totalCredit };
  };

  const handlePrint = async () => {
    toast({ title: "Preparing print...", description: "Please wait while we prepare the document." });

    if (!showPdfView) {
      setShowPdfView(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    try {
      await robustIframePrint("vendor-credit-pdf-content");
    } catch (error) {
      console.error("Print error:", error);
      toast({ title: "Error", description: "Failed to open print dialog.", variant: "destructive" });
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedCredit) return;
    toast({ title: "Preparing download...", description: "Please wait while we generate your PDF." });

    if (!showPdfView) {
      setShowPdfView(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    try {
      await generatePDFFromElement("vendor-credit-pdf-content", `VendorCredit-${selectedCredit.creditNumber}.pdf`);
      toast({ title: "Success", description: "Vendor credit downloaded successfully." });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    }
  };

  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const checkCompact = () => {
      setIsCompact(window.innerWidth < 1280);
    };

    checkCompact();
    window.addEventListener('resize', checkCompact);
    return () => window.removeEventListener('resize', checkCompact);
  }, []);

  return (
    <div className="h-screen flex w-full overflow-hidden bg-slate-50 animate-in fade-in duration-500">
      <ResizablePanelGroup key={`${selectedCredit ? "split" : "single"}-${isCompact ? "compact" : "full"}`} direction="horizontal" className="h-full w-full">
        {(!isCompact || !selectedCredit) && (
          <ResizablePanel
            defaultSize={isCompact ? 100 : (selectedCredit ? 33 : 100)}
            minSize={isCompact ? 100 : (selectedCredit ? 33 : 100)}
            maxSize={isCompact ? 100 : (selectedCredit ? 33 : 100)}
            className="flex flex-col overflow-hidden bg-white min-w-[25%]"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white sticky top-0 z-10 h-[73px]">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="gap-1.5 text-xl font-semibold text-slate-900 hover:text-slate-700 hover:bg-transparent p-0 h-auto transition-colors"
                      >
                        {viewLabels[currentView] || 'All Vendor Credits'}
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuItem onClick={() => setCurrentView('all')}>All</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setCurrentView('draft')}>Draft</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCurrentView('pending_approval')}>Pending Approval</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCurrentView('open')}>Open</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCurrentView('closed')}>Closed</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCurrentView('void')}>Void</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="text-sm text-slate-400">({vendorCredits.length})</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedCredit ? (
                  isSearchVisible ? (
                    <div className="relative w-full max-w-[200px] animate-in slide-in-from-right-5 fade-in-0 duration-200">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        autoFocus
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onBlur={() => !searchQuery && setIsSearchVisible(false)}
                        className="pl-9 h-9"
                      />
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 px-0"
                      data-testid="button-search-compact"
                      onClick={() => setIsSearchVisible(true)}
                    >
                      <Search className="h-4 w-4 text-slate-400" />
                    </Button>
                  )
                ) : (
                  <div className="relative w-[240px] hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search vendor credits..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                      data-testid="input-search-vendor-credits"
                    />
                  </div>
                )}

                <Button
                  className={`bg-sidebar hover:bg-sidebar/90 gap-1.5 h-9 font-display ${selectedCredit ? 'w-9 px-0' : ''}`}
                  size={selectedCredit ? "icon" : "default"}
                  onClick={() => setLocation('/vendor-credits/new')}
                  data-testid="button-add-vendor-credit"
                >
                  <Plus className="h-4 w-4" />
                  {!selectedCredit && <span>New</span>}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9" data-testid="button-more-options">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                        <span>Sort by</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleSort('name')}>
                            Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSort('date')}>
                            Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSort('amount')}>
                            Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSort('unusedCredits')}>
                            Unused Credits {sortBy === 'unusedCredits' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSort('createdTime')}>
                            Created Time {sortBy === 'createdTime' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSort('lastModifiedTime')}>
                            Last Modified Time {sortBy === 'lastModifiedTime' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json,.csv';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) toast({ title: "Importing...", description: file.name });
                      };
                      input.click();
                    }}>
                      <Upload className="mr-2 h-4 w-4" /> Import
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const data = JSON.stringify(vendorCredits, null, 2);
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'vendor_credits.json';
                      a.click();
                    }}>
                      <Download className="mr-2 h-4 w-4" /> Export
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>



            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : vendorCredits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Receipt className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2" data-testid="text-vendor-credits-empty">No vendor credits</h3>
                <p className="text-muted-foreground mb-4 max-w-sm text-sm">
                  Record credits from vendors for returns or adjustments to apply against future bills.
                </p>
                <Button
                  className="gap-2 bg-sidebar hover:bg-sidebar/90 font-display"
                  onClick={() => setLocation('/vendor-credits/new')}
                  data-testid="button-add-first-vendor-credit"
                >
                  <Plus className="h-4 w-4" /> Add Your First Vendor Credit
                </Button>
              </div>
            ) : selectedCredit ? (
              <div className="flex-1 overflow-auto scrollbar-hide">
                {paginatedItems.map((credit) => (
                  <div
                    key={credit.id}
                    className={`p-3 border-b cursor-pointer transition-colors ${selectedCredit?.id === credit.id ? 'bg-sidebar/5 border-l-2 border-l-sidebar' : 'hover:bg-muted/50'
                      }`}
                    onClick={() => setSelectedCredit(credit)}
                    data-testid={`row-vendor-credit-${credit.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-vendor-credit-${credit.id}`}
                        />
                        <div>
                          <p className="font-medium text-sm">{credit.vendorName}</p>
                          <p className="text-primary text-xs">{credit.creditNumber} | {formatDate(credit.date)}</p>
                          <Badge
                            variant="outline"
                            className={`mt-1 text-xs ${credit.status === 'OPEN' ? 'text-sidebar border-sidebar/20' :
                              credit.status === 'CLOSED' ? 'text-gray-600 border-gray-200' :
                                'text-yellow-600 border-yellow-200'
                              }`}
                          >
                            {credit.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency(credit.amount)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto scrollbar-hide">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                          <Checkbox data-testid="checkbox-select-all" />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                        <th className="px-4 py-3 text-left font-semibold">Credit Note#</th>
                        <th className="px-4 py-3 text-left font-semibold text-xs text-slate-500 uppercase">Reference Number</th>
                        <th className="px-4 py-3 text-left font-semibold">Vendor Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Amount</th>
                        <th className="px-4 py-3 text-right font-semibold">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedItems.map((credit) => (
                        <tr
                          key={credit.id}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setSelectedCredit(credit)}
                          data-testid={`row-vendor-credit-${credit.id}`}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox data-testid={`checkbox-vendor-credit-${credit.id}`} />
                          </td>
                          <td className="px-4 py-3 text-sm">{formatDate(credit.date)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-primary">{credit.creditNumber}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{credit.referenceNumber || credit.orderNumber || '-'}</td>
                          <td className="px-4 py-3 text-sm uppercase">{credit.vendorName}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge
                              variant="outline"
                              className={`${credit.status === 'OPEN' ? 'text-sidebar border-sidebar/20 bg-sidebar/5' :
                                credit.status === 'CLOSED' ? 'text-gray-600 border-gray-200 bg-gray-50' :
                                  'text-yellow-600 border-yellow-200 bg-yellow-50'
                                }`}
                            >
                              {credit.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {formatCurrency(credit.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatCurrency(credit.balance)}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-vendor-credit-actions-${credit.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => setLocation(`/vendor-credits/${credit.id}/edit`)}
                                  data-testid={`action-edit-${credit.id}`}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem data-testid={`action-clone-${credit.id}`}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Clone
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(credit.id)}
                                  data-testid={`action-delete-${credit.id}`}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {vendorCredits.length > 0 && (
                  <div className="flex-none border-t border-slate-200 bg-white">
                    <TablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      itemsPerPage={itemsPerPage}
                      onPageChange={goToPage}
                    />
                  </div>
                )}
              </>
            )}
          </ResizablePanel>
        )}

        {selectedCredit && (
          <>
            {!isCompact && (
              <ResizableHandle withHandle className="w-1 bg-slate-200 hover:bg-sidebar/60 hover:w-1.5 transition-all cursor-col-resize" />
            )}
            <ResizablePanel defaultSize={isCompact ? 100 : 65} minSize={isCompact ? 100 : 30} className="bg-white">
              <div className="flex flex-col overflow-hidden bg-muted/20 h-full">
                <div className="flex items-center justify-between gap-2 p-3 border-b bg-background">
                  <h2 className="font-semibold text-lg">{selectedCredit.creditNumber}</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setLocation(`/vendor-credits/${selectedCredit.id}/edit`)}
                      data-testid="button-edit-credit"
                    >
                      <Edit className="h-4 w-4" /> Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1" data-testid="button-pdf-print">
                          <Printer className="h-4 w-4" /> PDF/Print <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleDownloadPDF}>
                          <Download className="mr-2 h-4 w-4" /> Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handlePrint}>
                          <Printer className="mr-2 h-4 w-4" /> Print
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" data-testid="button-apply-to-bills" onClick={handleApplyToBills} disabled={!selectedCredit || selectedCredit.balance <= 0}>
                      Apply to Bills
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-more-actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={handleRefund}
                          className="text-primary font-medium"
                          data-testid="menu-refund"
                        >
                          Refund
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleVoid}
                          data-testid="menu-void"
                        >
                          <Ban className="mr-2 h-4 w-4" /> Void
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowPdfView(!showPdfView)}
                        >
                          <Eye className="mr-2 h-4 w-4" /> {showPdfView ? 'View Details' : 'View PDF'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleClone}
                          data-testid="menu-clone"
                        >
                          <Copy className="mr-2 h-4 w-4" /> Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleViewJournal}
                          data-testid="menu-view-journal"
                        >
                          <BookOpen className="mr-2 h-4 w-4" /> View Journal
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(selectedCredit.id)}
                          data-testid="menu-delete"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedCredit(null)}
                      data-testid="button-close-detail"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto scrollbar-hide p-4">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="h-auto p-0 bg-transparent gap-6 mb-4">
                      <TabsTrigger
                        value="document"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-sidebar data-[state=active]:text-sidebar data-[state=active]:bg-transparent data-[state=active]:shadow-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-3 bg-transparent hover:bg-transparent transition-none"
                      >
                        Overview
                      </TabsTrigger>
                      <TabsTrigger
                        value="journal"
                        ref={journalTabRef}
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-sidebar data-[state=active]:text-sidebar data-[state=active]:bg-transparent data-[state=active]:shadow-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-3 bg-transparent hover:bg-transparent transition-none"
                      >
                        Journal
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="document">
                      {showPdfView ? (
                        <div className="w-full max-w-[210mm] mx-auto shadow-lg bg-white my-8">
                          <div
                            id="vendor-credit-pdf-content"
                            className="bg-white"
                            style={{
                              width: '210mm',
                              minHeight: '296mm',
                              backgroundColor: 'white',

                              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                              color: '#0f172a',
                              margin: '0 auto',
                              boxSizing: 'border-box',
                              lineHeight: '1.5'
                            }}
                          >
                            <div style={{ padding: '40px' }}>
                              <div className="absolute top-0 left-0 -rotate-45 origin-center transform -translate-x-6 translate-y-8 no-print">
                                <Badge className="bg-sidebar text-white px-6 py-1 text-xs">
                                  {selectedCredit.status}
                                </Badge>
                              </div>
                              <div style={{ marginBottom: '40px' }}>
                                <PurchasePDFHeader
                                  logo={branding?.logo ?? undefined}
                                  documentTitle="VENDOR CREDIT"
                                  documentNumber={selectedCredit.creditNumber}
                                  date={selectedCredit.date}
                                  referenceNumber={selectedCredit.referenceNumber}
                                  organization={currentOrganization ?? undefined}
                                />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-12 mb-10">
                                <div style={{ borderLeft: '3px solid #f1f5f9', paddingLeft: '20px' }}>
                                  <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', margin: '0' }}>
                                    VENDOR ADDRESS
                                  </h4>
                                  <p style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '6px', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                                    {selectedCredit.vendorName}
                                  </p>
                                  <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
                                    {(() => {
                                      const vendor = getVendorDetails(selectedCredit.vendorId);
                                      if (vendor?.billingAddress) {
                                        return (
                                          <>
                                            {vendor.billingAddress.attention && (
                                              <p style={{ margin: '0' }}>{vendor.billingAddress.attention}</p>
                                            )}
                                            {vendor.billingAddress.street1 && (
                                              <p style={{ margin: '0' }}>{vendor.billingAddress.street1}</p>
                                            )}
                                            {vendor.billingAddress.street2 && (
                                              <p style={{ margin: '0' }}>{vendor.billingAddress.street2}</p>
                                            )}
                                            {(vendor.billingAddress.city || vendor.billingAddress.state) && (
                                              <p style={{ margin: '0' }}>
                                                {[vendor.billingAddress.city, vendor.billingAddress.state].filter(Boolean).join(', ')}
                                              </p>
                                            )}
                                            {(vendor.billingAddress.countryRegion || vendor.billingAddress.pinCode) && (
                                              <p style={{ margin: '0' }}>
                                                {[vendor.billingAddress.countryRegion, vendor.billingAddress.pinCode].filter(Boolean).join(' - ')}
                                              </p>
                                            )}
                                            {vendor.gstin && <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#991b1b' }}>GSTIN: {vendor.gstin}</p>}
                                          </>
                                        );
                                      }
                                      return <p style={{ margin: '0' }}>-</p>;
                                    })()}
                                  </div>
                                </div>
                                <div style={{ borderLeft: '3px solid #f1f5f9', paddingLeft: '20px' }}>
                                  <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', margin: '0' }}>
                                    SHIP TO
                                  </h4>
                                  <p style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '6px', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                                    {currentOrganization?.name || 'Your Company'}
                                  </p>
                                  <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
                                    <p style={{ margin: '0' }}>{currentOrganization?.street1 || ''} {currentOrganization?.city || ''}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-[2px] mb-10 bg-slate-100 rounded-lg overflow-hidden border border-slate-100">
                                <div style={{ backgroundColor: '#ffffff', padding: '16px' }}>
                                  <p style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Credit Date</p>
                                  <p style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: '0' }}>{formatDate(selectedCredit.date)}</p>
                                </div>
                                <div style={{ backgroundColor: '#ffffff', padding: '16px' }}>
                                  <p style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Reference#</p>
                                  <p style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: '0' }}>{selectedCredit.referenceNumber || '-'}</p>
                                </div>
                                <div style={{ backgroundColor: '#ffffff', padding: '16px' }}>
                                  <p style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Status</p>
                                  <p style={{ fontSize: '13px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', margin: '0' }}>{selectedCredit.status}</p>
                                </div>
                              </div>

                              {/* Items Table */}
                              <div style={{ marginBottom: '32px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#991b1b', color: '#ffffff' }}>
                                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '4px 0 0 0' }}>#</th>
                                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item & Description</th>
                                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Qty</th>
                                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Rate</th>
                                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', borderRadius: '0 4px 0 0' }}>Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedCredit.items.map((item, index) => (
                                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '16px', fontSize: '13px', color: '#64748b', verticalAlign: 'top' }}>{index + 1}</td>
                                        <td style={{ padding: '16px', verticalAlign: 'top' }}>
                                          <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>{item.itemName}</p>
                                          {item.description && (
                                            <p style={{ fontSize: '12px', color: '#64748b', margin: '0', lineHeight: '1.4' }}>{item.description}</p>
                                          )}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: '#0f172a', textAlign: 'center', verticalAlign: 'top', fontWeight: '600' }}>{item.quantity}</td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: '#0f172a', textAlign: 'right', verticalAlign: 'top' }}>
                                          {formatCurrency(typeof item.rate === 'string' ? parseFloat(item.rate) : item.rate)}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: '#0f172a', textAlign: 'right', verticalAlign: 'top', fontWeight: '700' }}>{formatCurrency(item.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Summary Section */}
                              <div className="flex flex-col md:flex-row gap-12">
                                <div className="flex-1 flex flex-col gap-5">
                                  {selectedCredit.notes && (
                                    <div style={{ backgroundColor: '#fdfdfd', padding: '16px', borderRadius: '4px', borderLeft: '4px solid #fecaca' }}>
                                      <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', margin: '0 0 8px 0' }}>
                                        Notes
                                      </h4>
                                      <p style={{ fontSize: '13px', color: '#475569', margin: '0', lineHeight: '1.6' }}>{selectedCredit.notes}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="w-full md:w-[320px] bg-slate-50 rounded-lg p-5 border border-slate-100 self-start">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Sub Total</span>
                                    <span style={{ color: '#0f172a', fontWeight: '700' }}>{formatCurrency(selectedCredit.subTotal)}</span>
                                  </div>
                                  {(() => {
                                    const { cgst, sgst } = calculateTaxDetails(selectedCredit);
                                    return (
                                      <>
                                        {cgst > 0 && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
                                            <span style={{ color: '#64748b', fontWeight: '600' }}>CGST</span>
                                            <span style={{ color: '#0f172a', fontWeight: '700' }}>{formatCurrency(cgst)}</span>
                                          </div>
                                        )}
                                        {sgst > 0 && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
                                            <span style={{ color: '#64748b', fontWeight: '600' }}>SGST</span>
                                            <span style={{ color: '#0f172a', fontWeight: '700' }}>{formatCurrency(sgst)}</span>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Total</span>
                                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#991b1b' }}>{formatCurrency(selectedCredit.amount)}</span>
                                  </div>
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: '12px',
                                    padding: '12px',
                                    backgroundColor: '#fff5f5',
                                    borderRadius: '4px',
                                    border: '1px solid #fee2e2'
                                  }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>Credits Remaining</span>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#b91c1c' }}>{formatCurrency(selectedCredit.balance)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Signature Section */}
                              <div style={{ marginTop: '64px', display: 'flex', justifyContent: 'flex-end', textAlign: 'center' }}>
                                <div>
                                  {branding?.signature?.url ? (
                                    <img
                                      src={branding.signature.url}
                                      alt="Signature"
                                      style={{ maxHeight: '80px', maxWidth: '200px', objectFit: 'contain', marginBottom: '8px' }}
                                    />
                                  ) : (
                                    <div style={{ height: '80px', width: '200px', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }}></div>
                                  )}
                                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px', margin: '0' }}>
                                    Authorized Signature
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Summary Card */}
                          <Card className="bg-white dark:bg-card">
                            <CardContent className="p-6">
                              <div className="flex justify-between items-start mb-8">
                                <div>
                                  <h3 className="text-xl font-bold mb-1">Credit Note for {selectedCredit.vendorName}</h3>
                                  <p className="text-sm text-muted-foreground">Date: {formatDate(selectedCredit.date)}</p>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-primary">{formatCurrency(selectedCredit.amount)}</div>
                                  <Badge variant="outline" className="mt-1">{selectedCredit.status}</Badge>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-8">
                                <div>
                                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Credit Details</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between border-b pb-1">
                                      <span className="text-muted-foreground">Credit Number:</span>
                                      <span className="font-medium">{selectedCredit.creditNumber}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-1">
                                      <span className="text-muted-foreground">Reference:</span>
                                      <span className="font-medium">{selectedCredit.referenceNumber || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-1">
                                      <span className="text-muted-foreground">Remaining Balance:</span>
                                      <span className="font-bold text-green-600">{formatCurrency(selectedCredit.balance)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Recent Activity or Items list can go here if needed, but the PDF is better */}
                          <Card>
                            <CardContent className="p-6">
                              <p className="text-sm text-muted-foreground text-center">
                                Use the "View PDF" option to see the full document.
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="journal">
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant="outline" className="bg-sidebar/5 text-sidebar border-sidebar/20">INR</Badge>
                            <span className="text-sm text-muted-foreground">Amount is displayed in your base currency</span>
                          </div>

                          <h3 className="font-semibold mb-4">Vendor Credits</h3>

                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Account</th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Debit</th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Credit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const { entries, totalDebit, totalCredit } = getJournalEntries(selectedCredit);
                                  return (
                                    <>
                                      {entries.map((entry, index) => (
                                        <tr key={index} className="border-b">
                                          <td className="px-4 py-3 text-sm">{entry.account}</td>
                                          <td className="px-4 py-3 text-sm text-right">
                                            {entry.debit > 0 ? formatCurrency(entry.debit) : '0.00'}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-right">
                                            {entry.credit > 0 ? formatCurrency(entry.credit) : '0.00'}
                                          </td>
                                        </tr>
                                      ))}
                                      <tr className="bg-muted/30 font-semibold">
                                        <td className="px-4 py-3 text-sm"></td>
                                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(totalDebit)}</td>
                                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(totalCredit)}</td>
                                      </tr>
                                    </>
                                  );
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor Credit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vendor credit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund Vendor Credit</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the amount to refund from this vendor credit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Enter refund amount"
                data-testid="input-refund-amount"
              />
              <p className="text-xs text-muted-foreground">
                Maximum: {selectedCredit ? formatCurrency(selectedCredit.balance) : '0.00'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund"
                data-testid="input-refund-reason"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRefund}>
              Process Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Vendor Credit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void this vendor credit ({selectedCredit?.creditNumber})?
              This will mark the credit as void and it cannot be applied to any bills.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVoid} className="bg-orange-600 hover:bg-orange-700">
              Void Credit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apply to Bills Dialog */}
      <Dialog open={applyToBillsOpen} onOpenChange={setApplyToBillsOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Apply credits from {selectedCredit?.creditNumber}</DialogTitle>
            <DialogDescription>
              Select bills to apply credits and enter the amount to apply for each bill
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto scrollbar-hide">
            <div className="space-y-4 py-4">
              {/* Header with toggle and available credits */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="set-applied-date">Set Applied on Date</Label>
                    <Switch
                      id="set-applied-date"
                      checked={setAppliedOnDate}
                      onCheckedChange={setSetAppliedOnDate}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Available Credits:</p>
                  <p className="text-lg font-semibold text-primary">
                    {formatCurrency(selectedCredit?.balance || 0)} ({formatDate(selectedCredit?.date || '')})
                  </p>
                </div>
              </div>

              {/* Bills Table */}
              <div className="border rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">BILL#</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">BILL DATE</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">BILL AMOUNT</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">BILL BALANCE</th>
                        <th className="text-center p-3 text-sm font-medium text-muted-foreground">CREDITS APPLIED ON</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">CREDITS TO APPLY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorBills.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            No unpaid bills found for this vendor
                          </td>
                        </tr>
                      ) : (
                        vendorBills.map((bill) => (
                          <tr key={bill.id} className="border-t hover:bg-muted/30">
                            <td className="p-3 text-sm font-medium">{bill.billNumber}</td>
                            <td className="p-3 text-sm">{formatDate(bill.billDate)}</td>
                            <td className="p-3 text-sm text-right">{formatCurrency(bill.total)}</td>
                            <td className="p-3 text-sm text-right font-medium">{formatCurrency(bill.balanceDue)}</td>
                            <td className="p-3 text-sm text-center">
                              {setAppliedOnDate ? formatDate(new Date().toISOString()) : formatDate(selectedCredit?.date || '')}
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min="0"
                                max={Math.min(bill.balanceDue, getRemainingCredits() + (creditsToApply[bill.id] || 0))}
                                step="0.01"
                                value={creditsToApply[bill.id] || ''}
                                onChange={(e) => handleCreditAmountChange(bill.id, e.target.value)}
                                className="text-right"
                                placeholder="0.00"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="flex justify-end gap-8 p-4 bg-muted/50 rounded-lg">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount to Credit:</p>
                  <p className="text-lg font-semibold">{formatCurrency(getTotalAmountToCredit())}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Remaining credits:</p>
                  <p className="text-lg font-semibold text-primary">{formatCurrency(getRemainingCredits())}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyToBillsOpen(false)} disabled={isApplying}>
              Cancel
            </Button>
            <Button onClick={handleSaveApplyCredits} disabled={isApplying || getTotalAmountToCredit() === 0}>
              {isApplying ? "Applying..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Vendor Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-2">
                Drag and drop your CSV file here, or click to browse
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                id="import-vendor-credits-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    toast({ title: `File "${file.name}" selected for import` });
                    setImportDialogOpen(false);
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('import-vendor-credits-file')?.click()}
              >
                Browse Files
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Supported formats: CSV, XLSX
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preferences Dialog */}
      <Dialog open={preferencesDialogOpen} onOpenChange={setPreferencesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vendor Credits Preferences</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show closed credits</Label>
                <p className="text-xs text-slate-500">Display credits that have been fully applied</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Show balance alerts</Label>
                <p className="text-xs text-slate-500">Highlight credits with remaining balance</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-refresh list</Label>
                <p className="text-xs text-slate-500">Automatically refresh the credits list</p>
              </div>
              <Switch />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setPreferencesDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                toast({ title: "Preferences saved" });
                setPreferencesDialogOpen(false);
              }}>
                Save Preferences
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
