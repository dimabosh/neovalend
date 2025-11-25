'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: 'pending' | 'success' | 'error';
  transactionHash?: string;
  action: 'supply' | 'borrow' | 'repay' | 'approve' | 'faucet' | 'enable-collateral' | 'disable-collateral';
  amount?: string;
  symbol?: string;
  step?: string;
  stepDescription?: string;
  successMessage?: string;
}

export function TransactionModal({
  open,
  onOpenChange,
  status,
  transactionHash,
  action,
  amount,
  symbol,
  step,
  stepDescription,
  successMessage
}: TransactionModalProps) {
  const getActionText = () => {
    switch (action) {
      case 'supply':
        return 'пополнили';
      case 'borrow':
        return 'взяли займ';
      case 'repay':
        return 'погасили займ';
      case 'approve':
        return 'подтвердили';
      case 'faucet':
        return 'получили';
      case 'enable-collateral':
        return 'включили залог';
      case 'disable-collateral':
        return 'выключили залог';
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'pending':
        return 'Выполняем транзакцию';
      case 'success':
        return 'Успешно!';
      case 'error':
        return 'Ошибка';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-lg sm:text-xl font-semibold text-center">
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          {/* Status Icon */}
          <div className="flex justify-center">
            {status === 'pending' && (
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {status === 'success' && (
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === 'error' && (
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>

          {/* Step Indicator */}
          {step && stepDescription && status === 'pending' && (
            <div className="text-center mb-2 sm:mb-4">
              <div className="inline-block bg-blue-500/20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
                <span className="text-blue-400 font-semibold text-sm sm:text-base">Шаг {step}</span>
                <span className="text-gray-300 ml-1 sm:ml-2 text-sm sm:text-base">• {stepDescription}</span>
              </div>
            </div>
          )}

          {/* Message */}
          <div className="text-center space-y-2">
            {status === 'pending' && (
              <>
                <p className="text-gray-300 text-sm sm:text-base">
                  Подтвердите операцию в вашем кошельке
                </p>
                <p className="text-xs sm:text-sm text-gray-400">
                  В ожидании подтверждения транзакции...
                </p>
              </>
            )}
            {status === 'success' && (
              <>
                {successMessage ? (
                  <p className="text-gray-300 text-base sm:text-lg">
                    {successMessage}
                  </p>
                ) : (
                  <>
                    <p className="text-gray-300 text-base sm:text-lg">
                      Вы {getActionText()}
                    </p>
                    {(action === 'enable-collateral' || action === 'disable-collateral') && symbol ? (
                      <p className="text-xl sm:text-2xl font-bold text-white">
                        {symbol}
                      </p>
                    ) : amount && symbol ? (
                      <p className="text-xl sm:text-2xl font-bold text-white break-words">
                        {amount} {symbol}
                      </p>
                    ) : null}
                  </>
                )}
              </>
            )}
            {status === 'error' && (
              <p className="text-gray-300 text-sm sm:text-base">
                Транзакция отклонена или произошла ошибка
              </p>
            )}
          </div>

          {/* Transaction Link - Hidden for now since we don't capture hash */}
          {/* {status === 'success' && transactionHash && (
            <div className="pt-2">
              <a
                href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center text-blue-400 hover:text-blue-300 underline text-sm"
              >
                Посмотреть транзакцию в Etherscan →
              </a>
            </div>
          )} */}

          {/* Close Button (only for success/error) */}
          {status !== 'pending' && (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
              size="lg"
            >
              Закрыть
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
