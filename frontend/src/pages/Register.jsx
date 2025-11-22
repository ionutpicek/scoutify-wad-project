/* eslint-disable no-unused-vars */
import React from 'react';
import Photo from '../assets/ScoutifyBackground.png';
import { useNavigate } from 'react-router-dom';
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, getDocs, collection } from "firebase/firestore";



const Register = () => {
    const navigate = useNavigate();

    const [inputs, setInputs] = React.useState({
        fullName: '',
        username: '',
        teamName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [role, setRole] = React.useState("player");

    const [showPopup, setShowPopup] = React.useState(false);

    const handleChange = (e) => {
        setInputs({ ...inputs, [e.target.name]: e.target.value });
    };

    const checkPasswordMatch = () => {
        return inputs.password === inputs.confirmPassword;
    };

    const areAllFieldsFilled = () => {
        if(role === "manager") {
            return Object.values(inputs).every((value) => value.trim() !== '');
        } else {
        const { teamName, ...otherFields } = inputs;
        return Object.values(otherFields).every((value) => value.trim() !== '');
        }
    };

    const handleRegister = async () => {
        if (!areAllFieldsFilled()) {
            alert("Please fill out all fields before submitting.");
            return;
        }

        if (!checkPasswordMatch()) {
            alert("Passwords do not match. Please re-enter your password.");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(
            auth,
            inputs.email,
            inputs.password
            );
            const user = userCredential.user;

            // Send email verification link
            await sendEmailVerification(user);

            // Save registration info in Firestore
            await setDoc(doc(db, "users", user.uid), {
            fullName: inputs.fullName,
            username: inputs.username,
            teamName: inputs.teamName ? inputs.teamName : "N/A",
            email: inputs.email,
            createdAt: new Date(),
            role: role,       
            verified: false,   // always false at account creation
            });

            setShowPopup(true);
        } catch (error) {
            console.error("Registration error:", error.message);
            alert(error.message);
        }
    };

    const [teamsList, setTeamsList] = React.useState([]);

    React.useEffect(() => {
        const fetchTeams = async () => {
            try {
                const teamsSnapshot = await getDocs(collection(db, "team"));
                const teamsData = teamsSnapshot.docs.map(doc => doc.data());
                setTeamsList(teamsData);
            } catch (error) {
                console.error("Error fetching teams:", error);
            }
        };

        fetchTeams();
    }, []);


    const closePopup = () => {
        setShowPopup(false);
        navigate('/login'); // Redirect to login after clicking OK
    };

    const inputStyle = {
        padding: '12px 15px',
        width: 280,
        borderRadius: 8,
        border: name === "teamName" ? role === "manager" ? '1px solid #ffffff' : '1px solid #FF681F' : '1px solid #ccc',
        backgroundColor: '#fff8f0',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        fontSize: 16,
        outline: 'none',
        transition: 'all 0.2s ease-in-out',
        color: '#000000',
    };

    const inputFocusStyle = {
        borderColor: '#FF4500',
        boxShadow: '0 0 8px rgba(255,104,31,0.5)',
    };

    return (
        <div
            style={{
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                display: 'flex',
                backgroundImage: `url(${Photo})`,
                width: '100vw',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: '1px solid #000',
                    borderRadius: 20,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    height: '90vh',
                    boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.2)',
                    width: '49vw',
                }}
            >
                <p
                    style={{
                        fontSize: 48,
                        color: '#FF681F',
                        fontFamily: 'cursive',
                        marginBottom: 30,
                    }}
                >
                    Register
                </p>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 15,
                        color: '#000000',
                    }}
                >
                    {[
                        { name: 'fullName', placeholder: 'Full Name', type: 'text' },
                        { name: 'username', placeholder: 'Username', type: 'text' },
                        { name: 'email', placeholder: 'Email', type: 'email' },
                        { name: 'password', placeholder: 'Password', type: 'password' },
                        { name: 'confirmPassword', placeholder: 'Confirm Password', type: 'password' },
                    ].map((field) => (
                        
                        <input
                            key={field.name}
                            name={field.name}
                            type={field.type}
                            placeholder={field.placeholder}
                            value={inputs[field.name]}
                            onChange={handleChange}
                            style={inputStyle}
                            onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                            onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                        />
                    ))}
                    {role === "manager" ? (
                        <select
                            name="teamName"
                            value={inputs.teamName}
                            onChange={handleChange}
                            style={{...inputStyle, appearance:"none", width:"312px", cursor:"pointer"}}
                        >
                            <option value="">Select a Team</option>
                            {teamsList.map((team) => (
                                <option key={team.teamID || team.name} value={team.name}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            name="teamName"
                            type="text"
                            placeholder="Team Name"
                            value={inputs.teamName}
                            onChange={handleChange}
                            style={{ ...inputStyle, backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                            disabled
                        />
                    )}
                    
                <div style={{ display: "flex", flexDirection:"row", width:"25vw", height:"5vh", justifyContent: "space-between" }}>
                    <div
                        style={{
                            display: "flex",
                            flex: 10,
                            borderRadius: 8,
                            border:"1px solid #ccc",
                            backgroundColor: "#fff",
                            color: "#000",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: 14,
                            textAlign: "center",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        Are you a manager?
                    </div>
                    <button
                        onClick={() => setRole("manager")}
                        style={{
                            marginLeft: 10,
                            display: "flex",
                            flex: 2,
                            borderRadius: 8,
                            border: role === "manager" ? "2px solid #FF681F" : "1px solid #ccc",
                            backgroundColor: role === "manager" ? "#FFF4E8" : "#fff",
                            color: "#000",
                            cursor: "pointer",
                            fontWeight: "bold",
                            transition: "all 0.2s ease",
                            textAlign: "center",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                        Yes
                    </button>
                    <button
                        onClick={() => setRole("other")}
                        style={{
                            marginLeft: 10,
                            display: "flex",
                            flex: 2,
                            borderRadius: 8,
                            border: role === "other" ? "2px solid #FF681F" : "1px solid #ccc",
                            backgroundColor: role === "other" ? "#FFF4E8" : "#fff",
                            color: "#000",
                            cursor: "pointer",
                            fontWeight: "bold",
                            transition: "all 0.2s ease",
                            textAlign: "center",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                        No
                    </button>
                </div>

                    <button
                        style={{
                            marginTop: 20,
                            padding: '12px 25px',
                            backgroundColor: '#FF681F',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: 16,
                            transition: 'background 0.2s',
                        }}
                        onClick={handleRegister}
                        onMouseOver={(e) => (e.target.style.backgroundColor = '#FF4500')}
                        onMouseOut={(e) => (e.target.style.backgroundColor = '#FF681F')}
                    >
                        Submit
                    </button>
                </div>
            </div>

            {/* ✅ Popup only shows if all fields are filled and passwords match */}
            {showPopup && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            width: '60vw',
                            height: '30vh',
                            padding: '30px 50px',
                            borderRadius: 15,
                            textAlign: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                    >
                        <h2 style={{ color: '#FF681F', marginBottom: 10 }}>
                            Account Under Verification
                        </h2>
                        <p style={{ color: '#333', fontSize: 16, padding: '0 10vw' }}>
                            Thank you for registering!  
                            Your account is currently under review.  
                            You'll receive an email once you're ready to go!
                        </p>
                        <button
                            onClick={closePopup}
                            style={{
                                marginTop: 20,
                                backgroundColor: '#FF681F',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                padding: '10px 20px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                            }}
                            onMouseOver={(e) => (e.target.style.backgroundColor = '#FF4500')}
                            onMouseOut={(e) => (e.target.style.backgroundColor = '#FF681F')}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Register;