import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface InvoiceData {
    invoiceNo: string;
    date: Date;
    renterName: string;
    renterPhone?: string;
    ownerName: string;
    ownerPhone?: string;
    itemName: string;
    itemAddress: string;
    startDate: string;
    endDate: string;
    pricePerDay: number;
    totalAmount: number;
    type: 'RENTAL' | 'RETURN';
    penalties?: {
        description: string;
        amount: number;
    }[];
}

export const generateInvoiceBlob = async (data: InvoiceData): Promise<Blob> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFillColor(15, 23, 42); // Slate-900 like
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Pharma-Grid', 15, 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.type === 'RENTAL' ? 'RENTAL INVOICE' : 'RETURN INVOICE', pageWidth - 15, 25, { align: 'right' });

    // Invoice Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Invoice No: ${data.invoiceNo}`, 15, 55);
    doc.text(`Date: ${format(data.date, 'PPP')}`, 15, 60);

    // Address / Billing Info (Simplified for now as we might not have full addresses)
    doc.text('Bill To (Renter):', 15, 75);
    doc.setFont('helvetica', 'bold');
    doc.text(data.renterName || 'Valued Customer', 15, 80);
    if (data.renterPhone) {
        doc.setFont('helvetica', 'normal');
        doc.text(`Phone: ${data.renterPhone}`, 15, 85);
    }

    doc.setFont('helvetica', 'normal');
    const ownerX = pageWidth / 2 + 10;
    doc.text('Owner:', ownerX, 75);
    doc.setFont('helvetica', 'bold');
    doc.text(data.ownerName || 'Equipment Owner', ownerX, 80);
    if (data.ownerPhone) {
        doc.setFont('helvetica', 'normal');
        doc.text(`Phone: ${data.ownerPhone}`, ownerX, 85);
    }

    // Line Items
    const head = [['Description', 'Days/Qty', 'Unit Price', 'Total']];
    const body: any[] = [];

    // Rental Period Calculation
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // 1. Rental Charge
    body.push([
        `Rental: ${data.itemName}\n(${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')})`,
        `${diffDays} days`,
        `Rs. ${data.pricePerDay}`,
        `Rs. ${(diffDays * data.pricePerDay).toFixed(2)}`
    ]);

    let subtotal = diffDays * data.pricePerDay;

    // 2. Penalties (For Return Invoice)
    if (data.type === 'RETURN' && data.penalties && data.penalties.length > 0) {
        data.penalties.forEach(p => {
            body.push([
                `Penalty: ${p.description}`,
                '1',
                `Rs. ${p.amount}`,
                `Rs. ${p.amount.toFixed(2)}`
            ]);
            subtotal += p.amount;
        });
    }

    autoTable(doc, {
        startY: 95,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 80 },
            3: { halign: 'right' }
        }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFont('helvetica', 'bold');
    doc.text(`Total Amount: Rs. ${subtotal.toFixed(2)}`, pageWidth - 15, finalY, { align: 'right' });

    // Footer
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for using Pharma-Grid. This is a computer generated invoice.', pageWidth / 2, pageWidth * 1.3, { align: 'center' });

    return doc.output('blob');
};
