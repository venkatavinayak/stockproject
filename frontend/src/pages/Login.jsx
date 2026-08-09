import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { ShoppingBag } from 'lucide-react';

const Login = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black p-4">
      <div className="w-full max-w-md flex flex-col items-center animate-fade-in">
        {/* App Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-4 mb-4 text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30">
            <ShoppingBag size={32} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-title">
            SmartStock AI
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Store Owner Portal & Business ERP
          </p>
        </div>

        {/* Clerk Sign In Component with Custom Theme */}
        <SignIn 
          appearance={{
            variables: {
              colorPrimary: '#4f46e5', // indigo-600
              colorBackground: '#090d16', // slate-950
              colorText: '#f8fafc', // slate-50
              colorTextSecondary: '#94a3b8', // slate-400
              colorInputBackground: '#0f172a', // slate-900
              colorInputText: '#ffffff',
              colorBorder: '#1e293b' // slate-800
            },
            elements: {
              card: 'border border-white/10 shadow-2xl backdrop-blur-xl bg-slate-950/60 rounded-3xl p-6',
              headerTitle: 'font-title font-extrabold text-white text-xl',
              headerSubtitle: 'text-slate-400 text-sm',
              socialButtonsBlockButton: 'border border-slate-800 bg-slate-900/40 text-white hover:bg-slate-900/80 transition-all rounded-xl py-2.5',
              socialButtonsBlockButtonText: 'text-white font-semibold',
              formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95',
              formFieldLabel: 'text-xs font-semibold uppercase tracking-wider text-slate-400',
              formFieldInput: 'bg-slate-900/60 border border-slate-800 text-white rounded-xl py-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all',
              footerActionLink: 'text-indigo-400 hover:text-indigo-300 font-semibold',
              dividerText: 'text-slate-500 text-xs font-semibold uppercase tracking-wider',
              dividerLine: 'bg-slate-800'
            }
          }}
          routing="path"
          path="/login"
        />
      </div>
    </div>
  );
};

export default Login;
