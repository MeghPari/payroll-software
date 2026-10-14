export function toMinor(value:string|number) {
 const text=String(value);
 if(!/^\d+(\.\d{1,2})?$/.test(text))throw new Error('Enter a nonnegative amount with at most two decimal places.');
 const [whole,fraction='']=text.split('.');
 const amount=BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,'0'));
 if(amount>BigInt(9000000000000))throw new Error('Amount exceeds the supported limit.');
 return Number(amount);
}
export function toSignedMinor(value:string|number){const text=String(value).trim(),negative=text.startsWith('-');return(negative?-1:1)*toMinor(negative?text.slice(1):text);}
