"use client";

import { createContext, useContext } from "react";

/**
 * True for a call or room screen that lives inside the floating window. Such a screen closes the window instead of
 * navigating to another page when it is done, and uses the window's size for its layout.
 */
const EmbedContext = createContext(false);

export const EmbedProvider = EmbedContext.Provider;
export const useEmbedded = (): boolean => useContext(EmbedContext);
