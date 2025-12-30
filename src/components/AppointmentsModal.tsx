import { FiCalendar } from 'react-icons/fi';
import type { Patient, Appointment } from '../types';
import { Button } from './ui/button';

interface AppointmentsModalProps {
    patient: Patient;
    onClose: () => void;
    isOpen?: boolean;
}

export const AppointmentsModal = ({
    patient,
    onClose,
    isOpen = true
}: AppointmentsModalProps) => {
    if (!isOpen) return null;

    const getPatientName = (): string => {
        const first = patient.patient_first_name || '';
        const last = patient.patient_last_name || '';
        return `${first} ${last}`.trim() || 'Unknown';
    };

    const formatCurrency = (amount: string | number): string => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(numAmount)) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(numAmount);
    };

    const appointments = patient.appointments || [];
    const totalOutstanding = patient.total_outstanding_amount || patient.outstanding_amount || '0';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="liquid-glass-strong rounded-2xl max-w-lg w-full flex flex-col overflow-hidden shadow-2xl max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {/* <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <FiCalendar className="text-primary" size={20} />
                        </div> */}
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Appointments for {getPatientName()}</h2>
                            <p className="text-sm text-muted-foreground">{appointments.length} appointment{appointments.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <Button
                        onClick={onClose}
                        className="liquid-glass-btn-primary"
                    >
                        Close
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {appointments.length === 0 ? (
                        <div className="text-center py-8">
                            <FiCalendar className="mx-auto text-muted-foreground mb-2" size={32} />
                            <p className="text-muted-foreground">No appointments found</p>
                        </div>
                    ) : (
                        appointments.map((appointment: Appointment, index: number) => (
                            <div
                                key={appointment.id || index}
                                className="liquid-glass rounded-xl p-4 space-y-3"
                            >
                                {/* Date */}
                                <div className="flex items-center gap-2">
                                    <FiCalendar className="text-primary" size={16} />
                                    <span className="text-sm font-medium text-foreground/70">Date</span>
                                    <span className="ml-auto text-sm font-semibold text-foreground">
                                        {appointment.appointment_date_display || appointment.appointment_date || '-'}
                                    </span>
                                </div>

                                {/* Grid of financial details */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-foreground/60">Billed Fee</span>
                                        <span className="text-sm font-semibold text-foreground">{formatCurrency(appointment.billed_fee)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-foreground/60">Insurance Covered</span>
                                        <span className="text-sm font-semibold text-green-600">{formatCurrency(appointment.insurance_covered)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-foreground/60">Balance</span>
                                        <span className="text-sm font-semibold text-destructive">{formatCurrency(appointment.balance)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-foreground/60">Insurance Company</span>
                                        <span className="text-sm font-semibold text-foreground">{appointment.insurance_company || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/20 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Total Outstanding</span>
                            <span className="text-2xl font-bold text-foreground">{formatCurrency(totalOutstanding)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
