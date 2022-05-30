import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers,Contract,utils } from "ethers"
import React from "react"
import styles from "../styles/Home.module.css"
import { useForm, SubmitHandler } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from '@hookform/resolvers/yup';
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"


export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [event,setevent]= React.useState("")

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()
        const prov = new providers.JsonRpcProvider("http://localhost:8545")
        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)
        // initializing greeter contract 
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",Greeter.abi,prov)
        // Calling event listener function using ethersjs library . parsing bytes32 to string usign ethers
        // using react usestate to store the event
        contract.on('NewGreeting', (greeting: string) => {
            setevent(utils.parseBytes32String(greeting))
         })
        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }
    // Interface of forminput , used from reactform hook
    interface Iforminput {
        firstName: string;
        age: number;
        address: string;
    }
// yup schema for name, age,address , declaring there types and making them required
    const schema = yup.object({
        firstName: yup.string().required(),
        age: yup.number().positive().integer().required(),
        address: yup.string().required()
      }).required();

      const {register,handleSubmit,formState: {errors}} = useForm<Iforminput>({
        resolver: yupResolver(schema)
    });

    const onSubmit: SubmitHandler<Iforminput> = data => console.log(JSON.stringify(data));

    return (
        <div className={styles.container}>
            

            <main className={styles.main}>
        
            <form className={styles.formstyle} onSubmit = {handleSubmit(onSubmit)}>
                <label> Name </label>
                <input  {...register("firstName")}/>
                <p>{errors.firstName?.message}</p>
                <label> Age </label>
                <input  {...register("age")}/>
                <p>{errors.age?.message}</p>
                <label>Address</label>
                <input  {...register("address")}/>
                <p>{errors.address?.message}</p>
                <input className={styles.submitstyle} type="submit" />
                
            </form>
                <div style = {{border: "2px solid black", padding: 10, width: 400,marginTop: 30}}>
                    <h2 style = {{marginLeft: 110}}>Event Box</h2>
                <div className = {styles.logs}> {event}</div>

                </div>
                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
            </main>
        </div>
    )
}
