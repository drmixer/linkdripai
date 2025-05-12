import React from 'react';
import { Redirect } from 'wouter';

interface RedirectWrapperProps {
  to: string;
}

export default function RedirectWrapper({ to }: RedirectWrapperProps) {
  return <Redirect to={to} />;
}