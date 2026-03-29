import './App.css';
import { Link } from 'react-router-dom';
function Footer() {
            return (
                <footer className="footer">
                    <div className="row">
                        <div className="col d-flex">
                            <h4>INFORMATION</h4>
                            <Link to="/about">About Us</Link>
                            <a href="#contact">Contact Us</a>
                            <a href="#terms">Terms & Conditions</a>
                            </div>
                            <div className="col d-flex">
                            <h4>USEFUL LINKS</h4>
                            </div>
                            <div className="col d-flex">
                            <span><i className='bx bxl-facebook-square'></i></span>
                            <span><a href="https://instagram.com/chemebration_" target="_blank" rel="noreferrer"><i className='bx bxl-instagram-alt'></i></a></span>
                            <span><i className='bx bxl-tiktok-alt' ></i></span>
                            <span><a href="mailto:Chemebration@gmail.com"><i className='bx bx-envelope'></i></a></span>
                        </div>
                    </div>
                </footer>
            ); 
        }

export default Footer;
