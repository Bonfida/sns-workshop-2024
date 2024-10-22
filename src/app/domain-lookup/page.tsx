"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  getAllDomains,
  getMultipleRecordsV2,
  getPrimaryDomain,
  Record as RecordV2,
  reverseLookup,
} from "@bonfida/spl-name-service";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Divider } from "@/components/Divider";
import { Footer } from "@/components/Footer";
import { ReadOnlyInput } from "@/components/ReadOnlyInput";
import "@solana/wallet-adapter-react-ui/styles.css";
import { PublicKey } from "@solana/web3.js";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type RecordValues = Partial<Record<RecordV2, string>>;

const RECORDS = [
  RecordV2.Pic,
  RecordV2.Url,
  RecordV2.Twitter,
  RecordV2.Telegram,
];

export default function DomainLookupPage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [recordValues, setRecordValues] = useState<RecordValues>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getPrimaryOrFirst = async (publicKey: PublicKey) => {
      try {
        // Get primary domain using account public key
        const { reverse: primary, stale } = await getPrimaryDomain(
          connection,
          publicKey
        );
        if (!primary || !stale) {
          throw new Error("primary domain not found");
        }
        return primary;
      } catch {
        // Use the first domain if primary domain cannot be found
        const domains = await getAllDomains(connection, publicKey);
        if (domains.length === 0) return null;
        domains.sort((a, b) => a.toBase58().localeCompare(b.toBase58()));
        const first = await reverseLookup(connection, domains[0]);
        return first;
      }
    };

    const updateDomainAndRecords = async () => {
      if (!publicKey) {
        setPrimaryDomain("");
        setRecordValues({});
        return;
      }

      try {
        setLoading(true);
        const domain = await getPrimaryOrFirst(publicKey);
        if (!!domain) {
          // Get RecordV2 data from domain name
          const recordResults = await getMultipleRecordsV2(
            connection,
            domain,
            RECORDS,
            {
              deserialize: true,
            }
          );

          const newRecordValues = recordResults.reduce((prev, curr) => {
            if (curr) {
              return {
                ...prev,
                [curr.record]: curr.deserializedContent,
              };
            }
            return prev;
          }, {});

          setPrimaryDomain(domain);
          setRecordValues(newRecordValues);
        }
      } catch (error) {
        alert(error);
      } finally {
        setLoading(false);
      }
    };

    updateDomainAndRecords();
  }, [connection, publicKey]);

  return (
    <div className="grid min-h-screen grid-rows-[1fr_20px] items-center justify-items-center py-6">
      <main className="row-start-1 flex w-[480px] flex-col items-center justify-center gap-y-6">
        {recordValues.pic ? (
          <Image
            className="mb-2 size-24 rounded-full"
            src={recordValues.pic}
            alt="Profile pic"
            width={96}
            height={96}
          />
        ) : (
          <Image
            aria-hidden
            src={"/logo.svg"}
            alt="Sns logo"
            width={33}
            height={38}
            className={`mb-2 h-24 w-auto ${
              loading ? "animate-spin" : "animate-none"
            }`}
          />
        )}

        <WalletMultiButtonDynamic />

        <Divider />

        <div className="grid w-full gap-y-3">
          <ReadOnlyInput
            label="primary domain"
            value={primaryDomain ? `${primaryDomain}.sol` : ""}
          />
          {RECORDS.map((r) => (
            <ReadOnlyInput key={r} label={r} value={recordValues[r] || ""} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
