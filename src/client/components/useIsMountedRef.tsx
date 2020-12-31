import { useEffect, useRef } from "react";

export function useIsMountedRef() {
    const isMountedRef = useRef<boolean | null>(null);
    useEffect(() => {
        isMountedRef.current = true;

        return function cleanup() {
            isMountedRef.current = false
        };
    });

    return isMountedRef;
};